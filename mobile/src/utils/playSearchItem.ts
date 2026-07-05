import {Alert} from 'react-native';
import {mediaApi} from '../features/media/api/mediaApi';
import type {MediaSearchResult, PlayableMedia} from '../features/media/domain/types';
import type {MediaQuality} from '../features/media/domain/qualityPresets';
import {qualityLabel} from '../features/media/domain/qualityPresets';
import {getApiBaseUrl} from '../config';
import {openPlayerScreen} from '../navigation/navigationRef';
import {
  DownloadProgress,
  downloadMediaToDevice,
  downloadSearchItemToDevice,
  getLocalPlaybackUri,
} from './localMediaStore';
import {resolveStreamUrl} from './mediaPlayback';
import {
  getPrefetchedStream,
  prefetchMediaPrepare,
  putPrefetchedStream,
  warmMediaServer,
} from './mediaPrefetch';

function isLanBackend(base = getApiBaseUrl()): boolean {
  return base.startsWith('http://') && !base.includes('onrender.com');
}

function isYoutubeBlockedMessage(message: string): boolean {
  return /not a bot|sign in to confirm|blocked this server|youtube blocked|blocked cloud/i.test(
    message,
  );
}

const SESSION_STREAM_TTL_MS = 30 * 60 * 1000;
const sessionStreamCache = new Map<
  string,
  {streamPath: string; quality?: string; expiresAt: number}
>();

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function pollDelay(attempt: number): number {
  if (attempt < 20) {
    return 250;
  }
  if (attempt < 35) {
    return 500;
  }
  return 1000;
}

function sessionKey(videoId: string, type: 'AUDIO' | 'VIDEO'): string {
  return `${type}:${videoId}`;
}

function getSessionStream(
  videoId: string,
  type: 'AUDIO' | 'VIDEO',
): {streamPath: string; quality?: string} | null {
  const hit = sessionStreamCache.get(sessionKey(videoId, type));
  if (!hit || Date.now() > hit.expiresAt) {
    sessionStreamCache.delete(sessionKey(videoId, type));
    return null;
  }
  return hit;
}

function putSessionStream(
  videoId: string,
  type: 'AUDIO' | 'VIDEO',
  streamPath: string,
  quality?: string,
): void {
  sessionStreamCache.set(sessionKey(videoId, type), {
    streamPath,
    quality,
    expiresAt: Date.now() + SESSION_STREAM_TTL_MS,
  });
  putPrefetchedStream(videoId, type, streamPath, quality);
}

function isPlayablePath(path: string): boolean {
  if (!path) {
    return false;
  }
  if (path.includes('/api/media/prepare/')) {
    return false;
  }
  return (
    path.startsWith('http://') ||
    path.startsWith('https://') ||
    path.startsWith('/files/') ||
    path.startsWith('/api/media/stream/') ||
    path.startsWith('file://')
  );
}

function mediaServerHint(): string {
  if (isLanBackend()) {
    return 'Using nearby MediaFace backend on Wi‑Fi.';
  }
  return (
    'Cloud needs YouTube cookies on Render.\n\n' +
    'On Mac run: ./scripts/export-youtube-cookies.sh\n' +
    'Paste into Render → YOUTUBE_COOKIES_BASE64\n\n' +
    'Or start Mac backend on same Wi‑Fi (auto-discovered).'
  );
}

async function assertPlaybackCapable(): Promise<void> {
  let status;
  try {
    status = await mediaApi.status();
  } catch {
    return;
  }
  if (status.success && status.data?.playDownload === 'LIMITED' && !isLanBackend()) {
    throw new Error(mediaServerHint());
  }
}

function resolveReadyStream(
  videoId: string,
  type: 'AUDIO' | 'VIDEO',
): {streamPath: string; quality?: string} | null {
  return getSessionStream(videoId, type) || getPrefetchedStream(videoId, type);
}

/** Fast playback: session/prefetch cache → device file → prepare poll. */
export async function waitForMediaReady(
  videoId: string,
  type: 'AUDIO' | 'VIDEO',
  onStatus?: (message?: string) => void,
  _searchItem?: Pick<MediaSearchResult, 'audioStreamUrl' | 'videoStreamUrl'>,
): Promise<{streamPath: string; quality?: string}> {
  const cachedSession = getSessionStream(videoId, type);
  if (cachedSession) {
    onStatus?.('Resuming stream…');
    return cachedSession;
  }

  const prefetched = getPrefetchedStream(videoId, type);
  if (prefetched) {
    onStatus?.('Starting stream…');
    putSessionStream(videoId, type, prefetched.streamPath, prefetched.quality);
    return prefetched;
  }

  const localUri = await getLocalPlaybackUri(videoId, type);
  if (localUri) {
    onStatus?.('Playing from device storage…');
    putSessionStream(videoId, type, localUri, 'On device · Offline');
    return {streamPath: localUri, quality: 'On device · Offline'};
  }

  if (!isLanBackend()) {
    await assertPlaybackCapable();
  }

  onStatus?.('Starting stream…');
  void mediaApi.prepare(videoId, type).catch(() => undefined);
  return pollPrepareUntilReady(videoId, type, onStatus);
}

async function pollPrepareUntilReady(
  videoId: string,
  type: 'AUDIO' | 'VIDEO',
  onStatus?: (message?: string) => void,
): Promise<{streamPath: string; quality?: string}> {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    const status = await mediaApi.prepare(videoId, type);
    if (!status.success || !status.data) {
      throw new Error(status.message || 'Could not prepare media');
    }

    const {data} = status;
    if (data.status === 'FAILED') {
      const msg = data.message || 'Media prepare failed on server';
      throw new Error(isYoutubeBlockedMessage(msg) ? `${msg}\n\n${mediaServerHint()}` : msg);
    }

    if (data.status === 'PREPARING') {
      onStatus?.(data.message || 'Buffering…');
    }

    if (data.status === 'READY' && data.streamUrl && isPlayablePath(data.streamUrl)) {
      putSessionStream(videoId, type, data.streamUrl, data.quality);
      return {streamPath: data.streamUrl, quality: data.quality};
    }

    await sleep(pollDelay(attempt));
  }

  throw new Error(`Stream took too long to start.\n\n${mediaServerHint()}`);
}

export interface PlaybackController {
  beginPlayback: (media: PlayableMedia) => void;
  attachStreamUrl: (media: PlayableMedia, streamUrl: string) => void;
}

export async function prepareAndStartPlayback(
  item: MediaSearchResult,
  type: 'AUDIO' | 'VIDEO',
  playback: PlaybackController,
  onStatus?: (message?: string) => void,
  quality?: MediaQuality,
): Promise<void> {
  const mediaBase: PlayableMedia = {
    title: item.title,
    type,
    streamUrl: '',
    thumbnailUrl: item.thumbnailUrl,
    quality: quality ? qualityLabel(type, quality) : type === 'AUDIO' ? item.audioFormat : item.videoFormat,
    sourceUrl: item.sourceUrl,
    videoId: item.videoId,
  };

  prefetchMediaPrepare(item.videoId, type);

  try {
    await warmMediaServer();
    if (!isLanBackend()) {
      await assertPlaybackCapable();
    }
  } catch (error) {
    showPlaybackError(error);
    throw error;
  }

  const instant = resolveReadyStream(item.videoId, type);
  if (instant) {
    const streamUrl = resolveStreamUrl(instant.streamPath);
    const media: PlayableMedia = {
      ...mediaBase,
      streamUrl,
      quality: instant.quality || mediaBase.quality,
    };
    openPlayerScreen(media, streamUrl);
    playback.beginPlayback(media);
    onStatus?.('Playing…');
    return;
  }

  openPlayerScreen(mediaBase, '');
  playback.beginPlayback(mediaBase);
  onStatus?.('Opening player…');

  try {
    const {streamPath, quality} = await waitForMediaReady(item.videoId, type, onStatus, item);
    const streamUrl = resolveStreamUrl(streamPath);
    const media: PlayableMedia = {
      ...mediaBase,
      streamUrl,
      quality: quality || mediaBase.quality,
    };
    playback.attachStreamUrl(media, streamUrl);
    openPlayerScreen(media, streamUrl);
  } catch (error) {
    showPlaybackError(error);
    throw error;
  }
}

export async function saveMediaToDevice(
  payload: {
    videoId: string;
    title: string;
    sourceUrl: string;
    type: 'AUDIO' | 'VIDEO';
    thumbnailUrl?: string;
  },
  onProgress?: (message: string) => void,
): Promise<void> {
  await downloadMediaToDevice(payload, progress => {
    if (progress.percent > 0 && progress.percent < 100) {
      onProgress?.(`Saving to device… ${progress.percent}%`);
    } else if (progress.percent >= 100) {
      onProgress?.('Saved on this device');
    }
  });
}

export async function saveSearchItemToDevice(
  item: MediaSearchResult,
  type: 'AUDIO' | 'VIDEO',
  onProgress?: (message: string) => void,
  quality?: string,
): Promise<void> {
  await downloadSearchItemToDevice(item, type, progress => {
    if (progress.percent > 0 && progress.percent < 100) {
      onProgress?.(`Saving to device… ${progress.percent}%`);
    } else if (progress.percent >= 100) {
      onProgress?.('Saved on this device');
    }
  }, quality);
}

export function showPlaybackError(error: unknown): void {
  const raw =
    error instanceof Error
      ? error.message
      : 'Stream could not start. Check connection and try again.';
  Alert.alert('Playback failed', raw);
}

export function showDownloadError(error: unknown): void {
  const raw =
    error instanceof Error
      ? error.message
      : 'Download failed. Check backend and network.';
  const message = isYoutubeBlockedMessage(raw) ? `${raw}\n\n${mediaServerHint()}` : raw;
  Alert.alert('Download failed', message);
}

export type {DownloadProgress};
