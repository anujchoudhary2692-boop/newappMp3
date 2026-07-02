import {ensureMediaServer} from '../core/api/httpClient';
import {mediaApi} from '../features/media/api/mediaApi';
import type {MediaSearchResult} from '../features/media/domain/types';

const prefetched = new Set<string>();
let mediaServerWarm: Promise<string> | null = null;

function jobKey(videoId: string, type: 'AUDIO' | 'VIDEO'): string {
  return `${type}:${videoId}`;
}

/** Keep media server discovery hot so play/download taps feel instant. */
export function warmMediaServer(force = false): Promise<string> {
  if (force) {
    mediaServerWarm = null;
  }
  if (!mediaServerWarm) {
    mediaServerWarm = ensureMediaServer().catch(error => {
      mediaServerWarm = null;
      throw error;
    });
  }
  return mediaServerWarm;
}

export function invalidateMediaServerWarm(): void {
  mediaServerWarm = null;
}

/** Start backend prepare in the background before the user taps play. */
export function prefetchMediaPrepare(
  videoId: string,
  type: 'AUDIO' | 'VIDEO' = 'AUDIO',
): void {
  const key = jobKey(videoId, type);
  if (prefetched.has(key)) {
    return;
  }
  prefetched.add(key);

  void warmMediaServer()
    .then(() => {
      void mediaApi.preparePlayUrl(videoId, type).catch(() => undefined);
      void mediaApi.prepare(videoId, type).catch(() => undefined);
    })
    .catch(() => {
      prefetched.delete(key);
    });
}

/** Warm server and prefetch top search hits while the list is visible. */
export function prefetchSearchResults(
  items: MediaSearchResult[],
  limit = 5,
): void {
  if (items.length === 0) {
    return;
  }
  void warmMediaServer().catch(() => undefined);
  items.slice(0, limit).forEach(item => {
    prefetchMediaPrepare(item.videoId, 'AUDIO');
  });
}
