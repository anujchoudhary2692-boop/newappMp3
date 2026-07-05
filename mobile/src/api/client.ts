/**
 * API facade — backward-compatible barrel over feature modules.
 * New code should import from feature api modules or core/api directly.
 */
import {getApiBaseUrl, isProductionMode} from '../config';
import {httpRequest, discoverServer, discoverLanMediaServer, ensureApiServer, ensureMediaServer, discoverMediaServer, wakeCloudServer, pickBestApiServer, pickBestMediaServer} from '../core/api/httpClient';
import type {ApiResponse, HealthResponse} from '../core/api/types/common';
import {mediaApi} from '../features/media/api/mediaApi';
import {faceApi} from '../features/face/api/faceApi';
import {captureApi} from '../features/camera/api/captureApi';

export type {ApiResponse};
export type {
  MediaSearchResult,
  PlayableMedia,
  MediaItem,
  PlayUrlResponse,
  PrepareStatusResponse,
  MediaDiagnostics,
  MediaType,
} from '../features/media/domain/types';
export type {
  FaceViewHint,
  Person,
  PersonPhoto,
  LibraryScanResult,
  FaceStatus,
  FaceCandidate,
  FaceIdentifyResult,
} from '../features/face/domain/types';
export type {PersonTimelineEntry} from '../features/face/domain/types';
export type {CaptureItem} from '../features/camera/domain/types';
export type {HealthResponse} from '../core/api/types/common';

export {discoverServer, discoverLanMediaServer, ensureApiServer, ensureMediaServer, discoverMediaServer, wakeCloudServer, pickBestApiServer, pickBestMediaServer};

export const api = {
  health: () =>
    httpRequest<HealthResponse>('/api/health', {}, isProductionMode() ? 180000 : 8000),

  features: () => httpRequest<Record<string, boolean>>('/api/features', {}, 8000),

  mediaStatus: () => mediaApi.status(),

  searchMedia: mediaApi.search,
  downloadMedia: mediaApi.download,
  preparePlayUrl: mediaApi.preparePlayUrl,
  prepareMedia: mediaApi.prepare,
  getAudioLibrary: mediaApi.getAudioLibrary,
  getVideoLibrary: mediaApi.getVideoLibrary,
  deleteMedia: mediaApi.delete,

  getPersons: faceApi.getPersons,
  getFaceStatus: faceApi.getStatus,
  registerPerson: faceApi.registerPerson,
  identifyFace: faceApi.identifyFace,
  deletePerson: faceApi.deletePerson,
  updatePerson: faceApi.updatePerson,
  getPersonPhotos: faceApi.getPersonPhotos,
  scanLibraryPhoto: faceApi.scanLibraryPhoto,
  deletePersonPhoto: faceApi.deletePersonPhoto,
  getPersonTimeline: faceApi.getPersonTimeline,
  getRecentAlerts: faceApi.getRecentAlerts,
  scanCapture: faceApi.scanCapture,
  scanMediaVideo: faceApi.scanMediaVideo,

  getCaptures: captureApi.list,
  getCapture: captureApi.get,
  uploadCapture: captureApi.upload,
  deleteCapture: captureApi.delete,

  getStreamUrl: mediaApi.resolveStreamUrl,
  getPlayStreamUrl: mediaApi.playStreamUrl,
  getImageUrl: (imageUrl?: string) =>
    imageUrl ? `${getApiBaseUrl()}${imageUrl}` : undefined,
};
