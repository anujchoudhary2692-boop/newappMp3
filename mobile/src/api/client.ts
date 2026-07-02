import {getApiBaseUrl, getApiKey, getMediaServerCandidates, getServerCandidates, isProductionMode, setApiBaseUrl} from '../config';
import {normalizeFaceImage} from '../utils/imageUpload';
import {resolveStreamUrl} from '../utils/mediaPlayback';
import {
  connectionErrorHint,
  isReachableHealthStatus,
  loadCachedApiUrl,
  networkErrorMessage,
  orderServerCandidates,
  probeTimeoutFor,
  requestTimeoutMessage,
  saveCachedApiUrl,
} from '../utils/serverConnection';

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export interface MediaSearchResult {
  videoId: string;
  title: string;
  thumbnailUrl: string;
  channel: string;
  durationSeconds?: number;
  sourceUrl: string;
  audioFormat?: string;
  videoFormat?: string;
  audioStreamUrl?: string;
  videoStreamUrl?: string;
}

export interface PlayableMedia {
  title: string;
  type: 'AUDIO' | 'VIDEO';
  streamUrl: string;
  thumbnailUrl?: string;
  quality?: string;
  sourceUrl?: string;
  videoId?: string;
  libraryId?: string;
}

export interface MediaItem {
  id: string;
  title: string;
  sourceUrl: string;
  type: 'AUDIO' | 'VIDEO';
  fileName: string;
  streamUrl: string;
  thumbnailUrl: string;
  fileSizeBytes?: number;
  quality?: string;
  durationSeconds?: number;
  downloadedAt?: string;
}

export type FaceViewHint = 'AUTO' | 'FRONT' | 'LEFT' | 'RIGHT' | 'PARTIAL';

export interface Person {
  id: string;
  name: string;
  notes?: string;
  imageUrl?: string;
  createdAt?: string;
  photoCount?: number;
  lastRegisteredView?: string;
  registeredViews?: string[];
}

export interface PersonPhoto {
  id: string;
  personId: string;
  imageUrl: string;
  confidence: number;
  matchedAt?: string;
  devicePhotoId?: string;
  sourceType?: 'PHOTO' | 'VIDEO' | string;
  sourceTimestampMs?: number;
  facesDetected?: number;
  groupPhoto?: boolean;
  matchedFaceIndex?: number;
}

export interface LibraryScanResult {
  devicePhotoId?: string;
  matched: boolean;
  saved: boolean;
  confidence: number;
  photoId?: string;
  facesDetected?: number;
  groupPhoto?: boolean;
  matchedFaceIndex?: number;
  sourceType?: string;
  sourceTimestampMs?: number;
}

export interface PlayUrlResponse {
  videoId: string;
  type: 'AUDIO' | 'VIDEO';
  streamUrl: string;
  contentType: string;
  quality?: string;
  cached: boolean;
}

export interface PrepareStatusResponse {
  videoId: string;
  type: 'AUDIO' | 'VIDEO';
  status: 'PREPARING' | 'READY' | 'FAILED';
  streamUrl?: string;
  contentType?: string;
  quality?: string;
  message?: string;
}

export interface FaceStatus {
  engineReady: boolean;
  registeredCount: number;
  message: string;
}

export interface FaceCandidate {
  personId: string;
  personName: string;
  confidence: number;
}

export interface FaceIdentifyResult {
  personId?: string;
  personName?: string;
  confidence: number;
  matched: boolean;
  facesScanned?: number;
  matchGap?: number;
  candidates?: FaceCandidate[];
}

export interface CaptureItem {
  id: string;
  type: 'PHOTO' | 'VIDEO';
  fileName: string;
  fileUrl: string;
  thumbnailUrl?: string;
  latitude?: number;
  longitude?: number;
  altitude?: number;
  address?: string;
  city?: string;
  country?: string;
  locationLabel?: string;
  capturedAt?: string;
  durationMs?: number;
}

/** Try cloud + local URLs until backend responds (Mac can be off if cloud works). */
export async function discoverServer(
  candidates = getServerCandidates(),
): Promise<string | null> {
  const apiKey = getApiKey();
  const cached = await loadCachedApiUrl();
  const ordered = orderServerCandidates(candidates, cached);

  for (const base of ordered) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), probeTimeoutFor(base));
      const headers: Record<string, string> = {Accept: 'application/json'};
      if (apiKey) {
        headers['X-API-Key'] = apiKey;
      }
      const response = await fetch(`${base}/api/health`, {
        signal: controller.signal,
        headers,
      });
      clearTimeout(timer);
      const json = await response.json();
      if (
        response.ok &&
        json.success &&
        isReachableHealthStatus(json.data?.status)
      ) {
        setApiBaseUrl(base);
        await saveCachedApiUrl(base);
        return base;
      }
    } catch {
      // try next
    }
  }
  return null;
}

/** For play/download — try Mac LAN first (yt-dlp works), then cloud. */
export async function discoverMediaServer(): Promise<string | null> {
  const candidates = getMediaServerCandidates();
  if (candidates.length === 0) {
    return getApiBaseUrl();
  }
  return discoverServer(candidates);
}

function defaultRequestTimeoutMs(): number {
  return isProductionMode() ? 180000 : 120000;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  timeoutMs = defaultRequestTimeoutMs(),
): Promise<ApiResponse<T>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const base = getApiBaseUrl();
  const apiKey = getApiKey();

  try {
    const response = await fetch(`${base}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(apiKey ? {'X-API-Key': apiKey} : {}),
        ...(options.body instanceof FormData
          ? {}
          : {'Content-Type': 'application/json'}),
        ...(options.headers as Record<string, string>),
      },
    });

    const text = await response.text();
    let json: ApiResponse<T>;
    try {
      json = text ? JSON.parse(text) : {success: false, message: 'Empty response', data: null as T};
    } catch {
      throw new Error(
        response.ok
          ? 'Invalid server response'
          : `Server error (${response.status}). ${connectionErrorHint()}`,
      );
    }

    if (!response.ok) {
      throw new Error(json.message || `Request failed (${response.status})`);
    }
    return json;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error(requestTimeoutMessage());
      }
      if (error.message === 'Network request failed') {
        throw new Error(networkErrorMessage(base));
      }
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export const api = {
  health: () =>
    request<{status: string; app: string}>(
      '/api/health',
      {},
      isProductionMode() ? 180000 : 8000,
    ),

  searchMedia: (q: string) =>
    request<MediaSearchResult[]>(
      `/api/media/search?q=${encodeURIComponent(q)}&limit=15`,
    ),

  downloadMedia: (payload: {
    videoId: string;
    title: string;
    sourceUrl: string;
    type: 'AUDIO' | 'VIDEO';
  }) =>
    request<MediaItem>('/api/media/download', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, 600000),

  preparePlayUrl: (videoId: string, type: 'AUDIO' | 'VIDEO') =>
    request<PlayUrlResponse>(
      `/api/media/play/${videoId}?type=${type}`,
      {},
      isProductionMode() ? 180000 : 60000,
    ),

  /** Poll until server cache or CDN URL is ready (use for playback on cloud). */
  prepareMedia: (videoId: string, type: 'AUDIO' | 'VIDEO') =>
    request<PrepareStatusResponse>(
      `/api/media/prepare/${videoId}?type=${type}`,
      {},
      isProductionMode() ? 120000 : 60000,
    ),

  getAudioLibrary: () =>
    request<MediaItem[]>('/api/media/library/audio'),

  getVideoLibrary: () =>
    request<MediaItem[]>('/api/media/library/video'),

  deleteMedia: (id: string) =>
    request<void>(`/api/media/${id}`, {method: 'DELETE'}),

  getPersons: () => request<Person[]>('/api/faces'),

  getFaceStatus: () => request<FaceStatus>('/api/faces/status'),

  registerPerson: async (
    name: string,
    notes: string,
    imageUri: string,
    viewHint: FaceViewHint = 'AUTO',
  ) => {
    const uri = await normalizeFaceImage(imageUri);
    const form = new FormData();
    form.append('name', name);
    form.append('notes', notes);
    form.append('viewHint', viewHint);
    form.append('image', {
      uri,
      type: 'image/jpeg',
      name: 'face.jpg',
    } as unknown as Blob);
    return request<Person>('/api/faces/register', {
      method: 'POST',
      body: form,
    });
  },

  identifyFace: async (imageUri: string) => {
    const uri = await normalizeFaceImage(imageUri);
    const form = new FormData();
    form.append('image', {
      uri,
      type: 'image/jpeg',
      name: 'query.jpg',
    } as unknown as Blob);
    return request<FaceIdentifyResult>('/api/faces/identify', {
      method: 'POST',
      body: form,
    });
  },

  deletePerson: (id: string) =>
    request<void>(`/api/faces/${id}`, {method: 'DELETE'}),

  updatePerson: (id: string, data: {name?: string; notes?: string}) =>
    request<Person>(`/api/faces/${id}`, {
      method: 'PATCH',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(data),
    }),

  getPersonPhotos: (personId: string) =>
    request<PersonPhoto[]>(`/api/faces/person/${personId}/photos`),

  scanLibraryPhoto: async (
    personId: string,
    imageUri: string,
    devicePhotoId?: string,
    iosAssetId?: string,
    sourceType: 'PHOTO' | 'VIDEO' = 'PHOTO',
    sourceTimestampMs?: number,
  ) => {
    const uri = await normalizeFaceImage(imageUri, iosAssetId);
    const form = new FormData();
    form.append('image', {
      uri,
      type: 'image/jpeg',
      name: 'library.jpg',
    } as unknown as Blob);
    if (devicePhotoId) {
      form.append('devicePhotoId', devicePhotoId);
    }
    form.append('sourceType', sourceType);
    if (sourceTimestampMs != null) {
      form.append('sourceTimestampMs', String(sourceTimestampMs));
    }
    return request<LibraryScanResult>(`/api/faces/person/${personId}/scan-library`, {
      method: 'POST',
      body: form,
    });
  },

  deletePersonPhoto: (photoId: string) =>
    request<void>(`/api/faces/photos/${photoId}`, {method: 'DELETE'}),

  getCaptures: () => request<CaptureItem[]>('/api/captures'),

  getCapture: (id: string) => request<CaptureItem>(`/api/captures/${id}`),

  uploadCapture: async (payload: {
    fileUri: string;
    fileName: string;
    mimeType: string;
    type: 'PHOTO' | 'VIDEO';
    latitude?: number;
    longitude?: number;
    altitude?: number;
    address?: string;
    city?: string;
    country?: string;
    durationMs?: number;
  }) => {
    const form = new FormData();
    form.append('file', {
      uri: payload.fileUri.startsWith('file://')
        ? payload.fileUri
        : `file://${payload.fileUri}`,
      type: payload.mimeType,
      name: payload.fileName,
    } as unknown as Blob);
    form.append('type', payload.type);
    if (payload.latitude != null) {
      form.append('latitude', String(payload.latitude));
    }
    if (payload.longitude != null) {
      form.append('longitude', String(payload.longitude));
    }
    if (payload.altitude != null) {
      form.append('altitude', String(payload.altitude));
    }
    if (payload.address) {
      form.append('address', payload.address);
    }
    if (payload.city) {
      form.append('city', payload.city);
    }
    if (payload.country) {
      form.append('country', payload.country);
    }
    if (payload.durationMs != null) {
      form.append('durationMs', String(payload.durationMs));
    }
    return request<CaptureItem>('/api/captures', {
      method: 'POST',
      body: form,
    }, 300000);
  },

  deleteCapture: (id: string) =>
    request<void>(`/api/captures/${id}`, {method: 'DELETE'}),

  getStreamUrl: (streamUrl: string) => resolveStreamUrl(streamUrl),

  getPlayStreamUrl: (videoId: string, type: 'AUDIO' | 'VIDEO') =>
    `${getApiBaseUrl()}/api/media/stream/${videoId}?type=${type}`,

  getImageUrl: (imageUrl?: string) =>
    imageUrl ? `${getApiBaseUrl()}${imageUrl}` : undefined,
};
