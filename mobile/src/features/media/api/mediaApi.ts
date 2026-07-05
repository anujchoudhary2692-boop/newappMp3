import {getApiBaseUrl, isProductionMode} from '../../../config';
import {resolveStreamUrl} from '../../../utils/mediaPlayback';
import {httpRequest} from '../../../core/api/httpClient';
import type {
  DownloadPayload,
  MediaDiagnostics,
  MediaItem,
  MediaSearchResult,
  PlayUrlResponse,
  PrepareStatusResponse,
} from '../domain/types';

export const mediaApi = {
  search: (q: string, signal?: AbortSignal) =>
    httpRequest<MediaSearchResult[]>(
      `/api/media/search?q=${encodeURIComponent(q)}&limit=15`,
      signal ? {signal} : {},
      isProductionMode() ? 180000 : 30000,
    ),

  status: () => httpRequest<MediaDiagnostics>('/api/media/status'),

  download: (payload: DownloadPayload) =>
    httpRequest<MediaItem>('/api/media/download', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, 600000),

  preparePlayUrl: (videoId: string, type: 'AUDIO' | 'VIDEO') =>
    httpRequest<PlayUrlResponse>(
      `/api/media/play/${videoId}?type=${type}`,
      {},
      5000,
    ),

  prepare: (videoId: string, type: 'AUDIO' | 'VIDEO', quality?: string, sourceUrl?: string) =>
    httpRequest<PrepareStatusResponse>(
      `/api/media/prepare/${videoId}?type=${type}${quality ? `&quality=${encodeURIComponent(quality)}` : ''}${
        sourceUrl ? `&sourceUrl=${encodeURIComponent(sourceUrl)}` : ''
      }`,
      {},
      15000,
    ),

  getAudioLibrary: () => httpRequest<MediaItem[]>('/api/media/library/audio'),

  getVideoLibrary: () => httpRequest<MediaItem[]>('/api/media/library/video'),

  delete: (id: string) => httpRequest<void>(`/api/media/${id}`, {method: 'DELETE'}),

  resolveStreamUrl: (streamUrl: string) => resolveStreamUrl(streamUrl),

  playStreamUrl: (videoId: string, type: 'AUDIO' | 'VIDEO', quality?: string) =>
    `${getApiBaseUrl()}/api/media/stream/${videoId}?type=${type}${
      quality ? `&quality=${encodeURIComponent(quality)}` : ''
    }`,
};
