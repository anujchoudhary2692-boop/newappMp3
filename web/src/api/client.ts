import {getApiBase, getApiKey} from '../config';
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
    request<{personName?: string; personId?: string; confidence?: number; matched?: boolean; candidates?: unknown[]}>('/api/faces/identify', {method: 'POST', body: form}, 60000),
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
};
