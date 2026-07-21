import {getApiBaseUrl, getApiKey, isProductionMode} from '../config';

/** Headers for YouTube CDN and our file streams — required on iOS for some hosts. */
export const MEDIA_STREAM_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  Accept: '*/*',
};

export type StreamResolveOpts = {
  videoId?: string;
  type?: 'AUDIO' | 'VIDEO';
  quality?: string;
};

/** CDN direct links resolved on Render are IP-bound — rewrite to our HTTPS proxy. */
export function preferPlayableStreamUrl(
  streamPath: string,
  opts?: StreamResolveOpts,
): string {
  const trimmed = (streamPath || '').trim();
  if (!trimmed || trimmed.startsWith('file://') || trimmed.startsWith('/files/')) {
    return trimmed;
  }
  if (trimmed.includes('/api/media/stream/') || trimmed.includes('/api/media/prepare/')) {
    return trimmed;
  }

  const looksLikeCdn =
    /googlevideo\.com|youtube\.com\/videoplayback|sndcdn\.com|cf-media\.sndcdn|audio-ak-spotify/i.test(
      trimmed,
    );
  if (isProductionMode() && looksLikeCdn && opts?.videoId && opts?.type) {
    const quality = opts.quality ? `&quality=${encodeURIComponent(opts.quality)}` : '';
    return `/api/media/stream/${opts.videoId}?type=${opts.type}${quality}`;
  }
  return trimmed;
}

/** Catalog CDN / direct files that need no yt-dlp prepare (Openverse, Jamendo, Freesound, ccMixter). */
export function isDirectCatalogSourceUrl(url?: string | null): boolean {
  if (!url) {
    return false;
  }
  const lower = url.toLowerCase();
  if (
    lower.includes('storage.jamendo.com') ||
    lower.includes('cdn.freesound.org') ||
    lower.includes('ccmixter.org/content/') ||
    lower.includes('archive.org/download/') ||
    lower.includes('upload.wikimedia.org')
  ) {
    return true;
  }
  const path = lower.split('?')[0];
  return (
    path.endsWith('.mp3') ||
    path.endsWith('.m4a') ||
    path.endsWith('.aac') ||
    path.endsWith('.mp4') ||
    path.endsWith('.m4v')
  );
}

/** Safe to play from the device without going through Render (faster). */
export function canClientStreamDirect(url?: string | null): boolean {
  if (!isDirectCatalogSourceUrl(url) || !url) {
    return false;
  }
  const lower = url.toLowerCase();
  if (
    lower.includes('ccmixter.org') ||
    lower.includes('archive.org/download/') ||
    lower.includes('us.archive.org')
  ) {
    return false;
  }
  return (
    lower.includes('storage.jamendo.com') ||
    lower.includes('cdn.freesound.org') ||
    lower.includes('upload.wikimedia.org') ||
    lower.split('?')[0].endsWith('.mp3') ||
    lower.split('?')[0].endsWith('.m4a') ||
    lower.split('?')[0].endsWith('.aac')
  );
}

/** Instant proxy path — no prepare poll. Source must already be registered (search or prepare). */
export function directCatalogStreamPath(
  videoId: string,
  type: 'AUDIO' | 'VIDEO',
  quality?: string,
): string {
  const q = quality ? `&quality=${encodeURIComponent(quality)}` : '';
  return `/api/media/stream/${videoId}?type=${type}${q}`;
}

export function resolveStreamUrl(
  streamPath: string,
  baseOverride?: string,
  opts?: StreamResolveOpts,
): string {
  const trimmed = preferPlayableStreamUrl(streamPath.trim(), opts);
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('file://')
  ) {
    return trimmed;
  }
  const base = (baseOverride || getApiBaseUrl()).replace(/\/$/, '');
  return `${base}${trimmed.startsWith('/') ? trimmed : `/${trimmed}`}`;
}

export function mediaStreamHeaders(streamUrl: string, baseOverride?: string): Record<string, string> {
  const apiKey = getApiKey();
  const headers = {...MEDIA_STREAM_HEADERS};
  const base = (baseOverride || getApiBaseUrl()).replace(/\/$/, '');
  if (apiKey && streamUrl.includes(base)) {
    headers['X-API-Key'] = apiKey;
  }
  return headers;
}

export function buildMediaSource(streamUrl: string, type: 'AUDIO' | 'VIDEO', baseOverride?: string) {
  if (streamUrl.startsWith('file://')) {
    return {
      uri: streamUrl,
    };
  }
  // Let AVPlayer sniff container — forcing mp4 breaks m4a/webm proxy streams on iOS.
  const lower = streamUrl.toLowerCase();
  const source: {uri: string; type?: 'mp4' | 'm3u8'; headers: Record<string, string>} = {
    uri: streamUrl,
    headers: mediaStreamHeaders(streamUrl, baseOverride),
  };
  if (lower.includes('.m3u8') || lower.includes('format=m3u8')) {
    source.type = 'm3u8';
  } else if (type === 'VIDEO' && lower.includes('.mp4') && !lower.includes('/api/media/stream/')) {
    source.type = 'mp4';
  }
  return source;
}
