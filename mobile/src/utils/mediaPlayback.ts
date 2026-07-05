import {getApiBaseUrl, getApiKey} from '../config';

/** Headers for YouTube CDN and our file streams — required on iOS for some hosts. */
export const MEDIA_STREAM_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  Accept: '*/*',
};

export function resolveStreamUrl(streamPath: string, baseOverride?: string): string {
  const trimmed = streamPath.trim();
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

export function buildMediaSource(streamUrl: string, _type: 'AUDIO' | 'VIDEO', baseOverride?: string) {
  if (streamUrl.startsWith('file://')) {
    return {
      uri: streamUrl,
      type: 'mp4' as const,
    };
  }
  return {
    uri: streamUrl,
    type: 'mp4' as const,
    headers: mediaStreamHeaders(streamUrl, baseOverride),
  };
}
