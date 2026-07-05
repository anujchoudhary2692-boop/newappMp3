import {api, resolveUrl} from '../api/client';
import type {MediaSearchResult, MediaType, PlayableMedia} from '../types/media';
import type {MediaQuality} from '../types/quality';
import {defaultQuality} from '../types/quality';
import {pushRecent} from '../stores/recent';

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

export async function pollPrepare(
  videoId: string,
  type: MediaType,
  quality: MediaQuality,
  onStatus?: (msg: string) => void,
): Promise<string> {
  const deadline = Date.now() + 240000;
  let attempt = 0;
  while (Date.now() < deadline) {
    try {
      const res = await api.prepare(videoId, type, quality);
      const d = res.data;
      if (d.status === 'FAILED') throw new Error(d.message || 'Prepare failed');
      if (d.status === 'READY' && d.streamUrl) return d.streamUrl;
      onStatus?.(d.message || 'Preparing on cloud… first play can take 1–2 min');
    } catch (e) {
      if (e instanceof Error && !/502|503|504|timed out|network/i.test(e.message)) throw e;
      onStatus?.('Server waking up…');
    }
    await sleep(attempt < 20 ? 250 : attempt < 35 ? 500 : 1000);
    attempt++;
  }
  throw new Error('Stream took too long. Cloud may need fresh YouTube cookies on Render.');
}

export async function startPlayback(
  item: MediaSearchResult,
  type: MediaType,
  quality?: MediaQuality,
  onStatus?: (msg: string) => void,
): Promise<{media: PlayableMedia; streamUrl: string}> {
  const preset = quality || defaultQuality(type);
  void api.prepare(item.videoId, type, preset).catch(() => undefined);
  const streamPath = await pollPrepare(item.videoId, type, preset, onStatus);
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
