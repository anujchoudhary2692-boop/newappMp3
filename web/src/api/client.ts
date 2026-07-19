import {getApiBase, getApiKey} from '../config';
import {getAuthToken} from '../utils/auth';
import type {
  CaptureItem,
  MediaDiagnostics,
  MediaItem,
  MediaSearchResult,
  Person,
  PersonTimelineEntry,
  PrepareStatus,
} from '../types/media';

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

async function request<T>(path: string, init: RequestInit = {}, timeoutMs = 120000): Promise<ApiResponse<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(init.body instanceof FormData ? {} : {'Content-Type': 'application/json'}),
    ...(getApiKey() ? {'X-API-Key': getApiKey()} : {}),
    ...(getAuthToken() ? {Authorization: `Bearer ${getAuthToken()}`} : {}),
    ...(init.headers as Record<string, string>),
  };

  try {
    const res = await fetch(`${getApiBase()}${path}`, {...init, headers, signal: controller.signal});
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.message || `Request failed (${res.status})`);
    }
    return json;
  } finally {
    clearTimeout(timer);
  }
}

export async function wakeServer(maxMs = 180000): Promise<boolean> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${getApiBase()}/api/health`, {headers: {Accept: 'application/json'}});
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data?.status === 'UP') return true;
      }
    } catch {
      // retry
    }
    await new Promise(r => setTimeout(r, 2500));
  }
  return false;
}

export function resolveUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${getApiBase()}${path.startsWith('/') ? path : `/${path}`}`;
}

export const api = {
  health: () => request<{status: string; media?: MediaDiagnostics; mediaStatus?: string}>('/api/health', {}, 30000),
  features: () => request<Record<string, boolean>>('/api/features', {}, 10000),
  mediaStatus: () => request<MediaDiagnostics>('/api/media/status'),

  streamInfo: (sourceUrl: string) =>
    request<{videoId: string; title: string; sourceUrl: string}>(
      `/api/media/stream-info?sourceUrl=${encodeURIComponent(sourceUrl)}`,
      {},
      60000,
    ),

  search: (q: string, limit = 15) =>
    request<MediaSearchResult[]>(`/api/media/search?q=${encodeURIComponent(q)}&limit=${limit}`, {}, 180000),

  prepare: (videoId: string, type: string, quality?: string, sourceUrl?: string) =>
    request<PrepareStatus>(
      `/api/media/prepare/${videoId}?type=${type}${quality ? `&quality=${quality}` : ''}${
        sourceUrl ? `&sourceUrl=${encodeURIComponent(sourceUrl)}` : ''
      }`,
      {},
      30000,
    ),

  download: (payload: {videoId: string; title: string; sourceUrl: string; type: string; quality?: string}) =>
    request<MediaItem>('/api/media/download', {method: 'POST', body: JSON.stringify(payload)}, 600000),

  audioLibrary: () => request<MediaItem[]>('/api/media/library/audio'),
  videoLibrary: () => request<MediaItem[]>('/api/media/library/video'),
  deleteMedia: (id: string) => request<void>(`/api/media/${id}`, {method: 'DELETE'}),

  listFaces: () => request<Person[]>('/api/faces'),
  faceStatus: () => request<{ready?: boolean; engineReady?: boolean; message: string}>('/api/faces/status'),
  registerFace: (form: FormData) =>
    request<Person>('/api/faces/register', {method: 'POST', body: form}, 60000),
  identifyFace: (form: FormData) =>
    request<{
      personName?: string;
      personId?: string;
      confidence?: number;
      matched?: boolean;
      candidates?: Array<{personId?: string; personName?: string; confidence?: number; imageUrl?: string; cropUrl?: string}>;
      galleryHits?: Array<{
        personName?: string;
        confidence?: number;
        imageUrl?: string;
        cropUrl?: string;
        sourceId?: string;
        sourceType?: string;
      }>;
    }>('/api/faces/identify', {method: 'POST', body: form}, 60000),
  listFaceClusters: () =>
    request<Array<{id: string; name: string; personId?: string; faceCount: number; sampleImageUrl?: string}>>(
      '/api/faces/clusters',
    ),
  nameFaceCluster: (id: string, name: string) =>
    request<unknown>(`/api/faces/clusters/${id}/name?name=${encodeURIComponent(name)}`, {method: 'POST'}),
  galleryFaceSearch: (form: FormData) =>
    request<
      Array<{
        personName?: string;
        confidence?: number;
        imageUrl?: string;
        cropUrl?: string;
        sourceId?: string;
        sourceType?: string;
      }>
    >('/api/faces/gallery-search', {method: 'POST', body: form}, 60000),
  listPlaces: () =>
    request<Array<{placeKey: string; city?: string; country?: string; count: number; latitude: number; longitude: number; sampleCaptureId?: string}>>(
      '/api/captures/places',
    ),
  personTimeline: (personId: string, limit = 200) =>
    request<PersonTimelineEntry[]>(`/api/faces/person/${personId}/timeline?limit=${limit}`),
  recentFaceAlerts: (limit = 50) =>
    request<PersonTimelineEntry[]>(`/api/faces/alerts/recent?limit=${limit}`),
  auditLog: (limit = 100) =>
    request<PersonTimelineEntry[]>(`/api/faces/audit/recent?limit=${limit}`),
  scanCaptureFaces: (captureId: string) =>
    request<{captureId: string; scanStatus: string; matchCount: number; message?: string}>(
      `/api/faces/scan-capture/${captureId}`,
      {method: 'POST'},
    ),
  scanMediaFaces: (videoId: string) =>
    request<string>(`/api/faces/scan-media/${videoId}`, {method: 'POST'}),
  deleteFace: (id: string) => request<void>(`/api/faces/${id}`, {method: 'DELETE'}),

  listCaptures: () => request<CaptureItem[]>('/api/captures'),
  uploadCapture: (form: FormData) =>
    request<CaptureItem>('/api/captures', {method: 'POST', body: form}, 120000),
  deleteCapture: (id: string) => request<void>(`/api/captures/${id}`, {method: 'DELETE'}),
  captureFileUrl: (id: string) => resolveUrl(`/api/captures/${id}/file`),

  authStatus: () =>
    request<{authRequired: boolean; roles: string[]}>('/api/auth/status', {}, 10000),
  login: (username: string, password: string) =>
    request<{token: string; user: {id: string; username: string; role: string; orgId?: string}}>(
      '/api/auth/login',
      {method: 'POST', body: JSON.stringify({username, password})},
      15000,
    ),
  authAudit: (limit = 100) =>
    request<Array<{id: string; action: string; actorUsername?: string; details?: string; createdAt?: string}>>(
      `/api/auth/audit?limit=${limit}`,
    ),
  listUsers: () =>
    request<Array<{id: string; username: string; role: string; orgId?: string}>>('/api/auth/users'),
  createUser: (body: {username: string; password: string; role: string; orgId?: string}) =>
    request<{id: string; username: string; role: string}>('/api/auth/users', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  librarySnapshot: () =>
    request<{
      playlists: Array<Record<string, unknown>>;
      favorites: Array<Record<string, unknown>>;
      recent: Array<Record<string, unknown>>;
      updatedAt?: string;
    }>('/api/library'),
  libraryMigrate: (body: {
    playlists: unknown[];
    favorites: unknown[];
    recent: unknown[];
  }) => request<unknown>('/api/library/migrate', {method: 'POST', body: JSON.stringify(body)}),
  libraryCreatePlaylist: (name: string) =>
    request<Record<string, unknown>>('/api/library/playlists', {
      method: 'POST',
      body: JSON.stringify({name}),
    }),
  libraryRenamePlaylist: (id: string, name: string) =>
    request<Record<string, unknown>>(`/api/library/playlists/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({name}),
    }),
  libraryDeletePlaylist: (id: string) =>
    request<{deleted: boolean}>(`/api/library/playlists/${id}`, {method: 'DELETE'}),
  libraryAddTrack: (playlistId: string, track: Record<string, unknown>) =>
    request<Record<string, unknown>>(`/api/library/playlists/${playlistId}/tracks`, {
      method: 'POST',
      body: JSON.stringify(track),
    }),
  libraryRemoveTrack: (playlistId: string, trackId: string) =>
    request<Record<string, unknown>>(`/api/library/playlists/${playlistId}/tracks/${trackId}`, {
      method: 'DELETE',
    }),
  libraryToggleFavorite: (body: Record<string, unknown>) =>
    request<{favorited: boolean}>('/api/library/favorites/toggle', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  libraryPushRecent: (body: Record<string, unknown>) =>
    request<unknown[]>('/api/library/recent', {method: 'POST', body: JSON.stringify(body)}),
};
