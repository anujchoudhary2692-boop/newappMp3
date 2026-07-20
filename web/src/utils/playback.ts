import {api, resolveUrl} from '../api/client';
import type {MediaSearchResult, MediaType, PlayableMedia} from '../types/media';
import type {MediaQuality} from '../types/quality';
import {defaultQuality} from '../types/quality';
import {pushRecent} from '../stores/recent';

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

function pollDelay(attempt: number): number {
  if (attempt < 12) return 120;
  if (attempt < 30) return 300;
  return 600;
}

/** CDN links resolved on Render are IP-bound — prefer our proxy path. */
function preferPlayableStreamPath(
  streamPath: string,
  videoId: string,
  type: MediaType,
  quality: MediaQuality,
): string {
  const trimmed = (streamPath || '').trim();
  if (!trimmed || trimmed.startsWith('/files/') || trimmed.includes('/api/media/stream/')) {
    return trimmed;
  }
  if (/googlevideo\.com|youtube\.com\/videoplayback|sndcdn\.com|cf-media\.sndcdn/i.test(trimmed)) {
    return `/api/media/stream/${videoId}?type=${type}&quality=${encodeURIComponent(quality)}`;
  }
  return trimmed;
}

export async function pollPrepare(
  videoId: string,
  type: MediaType,
  quality: MediaQuality,
  onStatus?: (msg: string) => void,
  sourceUrl?: string,
): Promise<string> {
  const deadline = Date.now() + 120000;
  let attempt = 0;
  while (Date.now() < deadline) {
    try {
      const res = await api.prepare(videoId, type, quality, sourceUrl);
      const d = res.data;
      if (d.status === 'FAILED') throw new Error(d.message || 'Prepare failed');
      if (d.status === 'READY' && d.streamUrl) {
        return preferPlayableStreamPath(d.streamUrl, videoId, type, quality);
      }
      onStatus?.(d.message || 'Getting stream ready…');
    } catch (e) {
      if (e instanceof Error && !/502|503|504|timed out|network|abort/i.test(e.message)) throw e;
      onStatus?.('Server waking up…');
      await sleep(Math.min(800, 250 + attempt * 80));
      attempt++;
      continue;
    }
    await sleep(pollDelay(attempt));
    attempt++;
  }
  throw new Error('Stream took too long. Try again or paste a direct link.');
}

export async function startPlayback(
  item: MediaSearchResult,
  type: MediaType,
  quality?: MediaQuality,
  onStatus?: (msg: string) => void,
): Promise<{media: PlayableMedia; streamUrl: string}> {
  const preset = quality || defaultQuality(type);
  // Kick prepare once; pollPrepare will keep calling until READY (idempotent on server).
  void api.prepare(item.videoId, type, preset, item.sourceUrl).catch(() => undefined);
  const streamPath = await pollPrepare(item.videoId, type, preset, onStatus, item.sourceUrl);
  const streamUrl = resolveUrl(streamPath);
  const media: PlayableMedia = {
    title: item.title,
    type,
    streamUrl,
    thumbnailUrl: item.thumbnailUrl,
    sourceUrl: item.sourceUrl,
    videoId: item.videoId,
    quality: preset,
  };
  pushRecent(media, streamUrl);
  return {media, streamUrl};
}

export async function downloadToBrowser(
  item: MediaSearchResult,
  type: MediaType,
  quality?: MediaQuality,
  onStatus?: (msg: string) => void,
) {
  onStatus?.('Downloading on cloud server…');
  const res = await api.download({
    videoId: item.videoId,
    title: item.title,
    sourceUrl: item.sourceUrl,
    type,
    quality: quality || defaultQuality(type),
  });
  onStatus?.('Saving file…');
  const url = resolveUrl(res.data.streamUrl);
  const a = document.createElement('a');
  a.href = url;
  a.download = res.data.fileName || `${item.title}.mp3`;
  a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  a.remove();
}
