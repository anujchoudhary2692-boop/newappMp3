import {Alert} from 'react-native';
import {
  api,
  discoverMediaServer,
  MediaSearchResult,
  PlayableMedia,
} from '../api/client';
import {getApiBaseUrl} from '../config';
import {openPlayerScreen} from '../navigation/navigationRef';
import {
  DownloadProgress,
  downloadMediaToDevice,
  downloadSearchItemToDevice,
  getLocalPlaybackUri,
} from './localMediaStore';
import {resolveStreamUrl} from './mediaPlayback';

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function pollDelay(attempt: number): number {
  if (attempt < 4) {
    return 800;
  }
  if (attempt < 10) {
    return 1500;
  }
  return 3000;
}

function isBrokenPipeUrl(url: string): boolean {
  return url.includes('/api/media/stream/');
}

function isPlayablePath(path: string): boolean {
  if (!path) {
    return false;
  }
  if (isBrokenPipeUrl(path)) {
    return false;
  }
  return (
    path.startsWith('http://') ||
    path.startsWith('https://') ||
    path.startsWith('/files/') ||
    path.startsWith('file://')
  );
}

function isYoutubeBlockedMessage(message: string): boolean {
  return /not a bot|sign in to confirm|blocked this server|youtube blocked/i.test(message);
}

function mediaServerHint(): string {
  const base = getApiBaseUrl();
  if (base.startsWith('http://')) {
    return 'Using your Mac backend on Wi‑Fi.';
  }
  return 'Cloud cannot download from YouTube without cookies. Start Mac backend on same Wi‑Fi, or set YOUTUBE_COOKIES_BASE64 on Render.';
}

/** Fast playback: device file → server play URL → prepare poll. */
export async function waitForMediaReady(
  videoId: string,
  type: 'AUDIO' | 'VIDEO',
  onStatus?: (message?: string) => void,
): Promise<{streamPath: string; quality?: string}> {
  const localUri = await getLocalPlaybackUri(videoId, type);
  if (localUri) {
    onStatus?.('Playing from device storage…');
    return {streamPath: localUri, quality: 'On device · Offline'};
  }

  await discoverMediaServer();
  onStatus?.('Connecting…');

  try {
    const play = await api.preparePlayUrl(videoId, type);
    if (play.success && play.data?.streamUrl) {
      const path = play.data.streamUrl;
      if (path.includes('/api/media/prepare/')) {
        onStatus?.('Preparing stream…');
      } else if (isPlayablePath(path)) {
        onStatus?.(play.data.cached ? 'Cached on server…' : 'Starting stream…');
        return {streamPath: path, quality: play.data.quality};
      }
    }
  } catch {
    onStatus?.('Preparing stream…');
  }

  for (let attempt = 0; attempt < 60; attempt += 1) {
    const status = await api.prepareMedia(videoId, type);
    if (!status.success || !status.data) {
      throw new Error(status.message || 'Could not prepare media');
    }

    const {data} = status;
    if (data.status === 'FAILED') {
      const msg = data.message || 'Media prepare failed on server';
      throw new Error(isYoutubeBlockedMessage(msg) ? `${msg}\n\n${mediaServerHint()}` : msg);
    }

    if (data.status === 'PREPARING') {
      onStatus?.(data.message || 'Downloading for playback…');
    }

    if (data.status === 'READY' && data.streamUrl && isPlayablePath(data.streamUrl)) {
      return {streamPath: data.streamUrl, quality: data.quality};
    }

    await sleep(pollDelay(attempt));
  }

  throw new Error(`Prepare timed out.\n\n${mediaServerHint()}`);
}

export async function prepareAndStartPlayback(
  item: MediaSearchResult,
  type: 'AUDIO' | 'VIDEO',
  startPlayback: (media: PlayableMedia, streamUrl: string) => void,
  onStatus?: (message?: string) => void,
): Promise<void> {
  const {streamPath, quality} = await waitForMediaReady(item.videoId, type, onStatus);
  const streamUrl = resolveStreamUrl(streamPath);

  const media: PlayableMedia = {
    title: item.title,
    type,
    streamUrl,
    thumbnailUrl: item.thumbnailUrl,
    quality: quality || (type === 'AUDIO' ? item.audioFormat : item.videoFormat),
    sourceUrl: item.sourceUrl,
    videoId: item.videoId,
  };

  startPlayback(media, streamUrl);
  openPlayerScreen(media, streamUrl);
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
