import {getApiBaseUrl, getApiKey, isProductionMode} from '../config';

/** Headers for YouTube CDN and our file streams — required on iOS for some hosts. */
export const MEDIA_STREAM_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  Accept: '*/*',
};

/** CDN direct links resolved on Render are IP-bound — rewrite to our HTTPS proxy. */
export function preferPlayableStreamUrl(
  streamPath: string,
  opts?: {videoId?: string; type?: 'AUDIO' | 'VIDEO'; quality?: string},
): string {
  const trimmed = (streamPath || '').trim();
  if (!trimmed || trimmed.startsWith('file://') || trimmed.startsWith('/files/')) {
    return trimmed;
  }
  if (trimmed.includes('/api/media/stream/') || trimmed.includes('/api/media/prepare/')) {
    return trimmed;
  }

  const looksLikeCdn =
    /googlevideo\.com|youtube\.com\/videoplayback|ytimg\.com|sndcdn\.com|cf-media\.sndcdn/i.test(
      trimmed,
    );
  if (isProductionMode() && looksLikeCdn && opts?.videoId && opts?.type) {
    const quality = opts.quality ? `&quality=${encodeURIComponent(opts.quality)}` : '';
    return `/api/media/stream/${opts.videoId}?type=${opts.type}${quality}`;
  }
  return trimmed;
}

export function resolveStreamUrl(streamPath: string, baseOverride?: string): string {
  const trimmed = preferPlayableStreamUrl(streamPath.trim());
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
  // Let AVPlayer sniff container — forcing mp4 breaks m4a/webm direct/proxy streams on iOS.
  const lower = streamUrl.toLowerCase();
  const source: {uri: string; type?: 'mp4' | 'm3u8'; headers: Record<string, string>} = {
    uri: streamUrl,
    headers: mediaStreamHeaders(streamUrl, baseOverride),
  };
  if (lower.includes('.m3u8') || lower.includes('format=m3u8')) {
    source.type = 'm3u8';
  } else if (type === 'VIDEO' && (lower.includes('.mp4') || lower.includes('/api/media/stream/'))) {
    source.type = 'mp4';
  }
  return source;
}
