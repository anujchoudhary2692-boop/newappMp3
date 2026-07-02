import {Alert} from 'react-native';
import {ensureMediaServer} from '../core/api/httpClient';
import {mediaApi} from '../features/media/api/mediaApi';
import type {MediaSearchResult, PlayableMedia} from '../features/media/domain/types';
import {getApiBaseUrl} from '../config';
import {openPlayerScreen} from '../navigation/navigationRef';
import {
  DownloadProgress,
  downloadMediaToDevice,
  downloadSearchItemToDevice,
  getLocalPlaybackUri,
} from './localMediaStore';
import {resolveStreamUrl} from './mediaPlayback';

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
  if (attempt < 12) {
    return 300;
  }
  if (attempt < 24) {
    return 600;
  }
  if (attempt < 40) {
    return 1000;
  }
  return 2000;
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
  return 'For playback anywhere, set YOUTUBE_COOKIES_BASE64 on Render. On Wi‑Fi, start Mac backend (auto-discovered).';
}

async function tryFastPlayUrl(
  videoId: string,
  type: 'AUDIO' | 'VIDEO',
): Promise<{streamPath: string; quality?: string} | null> {
  try {
    const play = await mediaApi.preparePlayUrl(videoId, type);
    if (play.success && play.data?.streamUrl && isPlayablePath(play.data.streamUrl)) {
      return {streamPath: play.data.streamUrl, quality: play.data.quality};
    }
  } catch {
    // fall through to prepare poll
  }
  return null;
}

/** Fast playback: session cache → device file → Mac backend stream → prepare poll. */
export async function waitForMediaReady(
  videoId: string,
  type: 'AUDIO' | 'VIDEO',
  onStatus?: (message?: string) => void,
  searchItem?: Pick<MediaSearchResult, 'audioStreamUrl' | 'videoStreamUrl'>,
): Promise<{streamPath: string; quality?: string}> {
  return waitForMediaReadyOnce(videoId, type, onStatus, searchItem);
}

async function waitForMediaReadyOnce(
  videoId: string,
  type: 'AUDIO' | 'VIDEO',
  onStatus?: (message?: string) => void,
  searchItem?: Pick<MediaSearchResult, 'audioStreamUrl' | 'videoStreamUrl'>,
): Promise<{streamPath: string; quality?: string}> {
  const cachedSession = getSessionStream(videoId, type);
  if (cachedSession) {
    onStatus?.('Resuming stream…');
    return cachedSession;
  }

  const localUri = await getLocalPlaybackUri(videoId, type);
  if (localUri) {
    onStatus?.('Playing from device storage…');
    putSessionStream(videoId, type, localUri, 'On device · Offline');
    return {streamPath: localUri, quality: 'On device · Offline'};
  }

  await ensureMediaServer();
  onStatus?.('Starting stream…');

  const searchStreamPath =
    type === 'AUDIO' ? searchItem?.audioStreamUrl : searchItem?.videoStreamUrl;
  if (isLanBackend() && searchStreamPath && isPlayablePath(searchStreamPath)) {
    putSessionStream(videoId, type, searchStreamPath, 'Streaming');
    return {streamPath: searchStreamPath, quality: 'Streaming'};
  }

  const pollControl = {cancelled: false};
  const pollPromise = pollPrepareUntilReady(videoId, type, onStatus, pollControl);
  const fastPlay = await tryFastPlayUrl(videoId, type);
  if (fastPlay) {
    pollControl.cancelled = true;
    void pollPromise.catch(() => {});
    putSessionStream(videoId, type, fastPlay.streamPath, fastPlay.quality);
    return fastPlay;
  }

  return pollPromise;
}

async function pollPrepareUntilReady(
  videoId: string,
  type: 'AUDIO' | 'VIDEO',
  onStatus?: (message?: string) => void,
  control?: {cancelled: boolean},
): Promise<{streamPath: string; quality?: string}> {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    if (control?.cancelled) {
      throw new Error('Playback cancelled');
    }

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
): Promise<void> {
  const mediaBase: PlayableMedia = {
    title: item.title,
    type,
    streamUrl: '',
    thumbnailUrl: item.thumbnailUrl,
    quality: type === 'AUDIO' ? item.audioFormat : item.videoFormat,
    sourceUrl: item.sourceUrl,
    videoId: item.videoId,
  };

  openPlayerScreen(mediaBase, '');
  playback.beginPlayback(mediaBase);
  onStatus?.('Opening player…');

  try {
    const {streamPath, quality} = await waitForMediaReady(
      item.videoId,
      type,
      onStatus,
      item,
    );
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
): Promise<void> {
  await downloadSearchItemToDevice(item, type, progress => {
    if (progress.percent > 0 && progress.percent < 100) {
      onProgress?.(`Saving to device… ${progress.percent}%`);
    } else if (progress.percent >= 100) {
      onProgress?.('Saved on this device');
    }
  });
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
