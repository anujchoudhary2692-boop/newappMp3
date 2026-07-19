import {httpRequest} from '../../../core/api/httpClient';
import type {CaptureItem, CaptureUploadPayload} from '../domain/types';

export const captureApi = {
  list: () => httpRequest<CaptureItem[]>('/api/captures'),

  get: (id: string) => httpRequest<CaptureItem>(`/api/captures/${id}`),

  upload: async (payload: CaptureUploadPayload) => {
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
    if (payload.gpsAccuracy != null) {
      form.append('gpsAccuracy', String(payload.gpsAccuracy));
    }
    if (payload.clientCapturedAt) {
      form.append('clientCapturedAt', payload.clientCapturedAt);
    }
    if (payload.durationMs != null) {
      form.append('durationMs', String(payload.durationMs));
    }
    if (payload.heading != null) {
      form.append('heading', String(payload.heading));
    }
    if (payload.trackPointsJson) {
      form.append('trackPointsJson', payload.trackPointsJson);
    }
    return httpRequest<CaptureItem>('/api/captures', {method: 'POST', body: form}, 300000);
  },

  places: () =>
    httpRequest<
      Array<{
        placeKey: string;
        city?: string;
        country?: string;
        count: number;
        latitude: number;
        longitude: number;
        sampleCaptureId?: string;
      }>
    >('/api/captures/places'),

  delete: (id: string) => httpRequest<void>(`/api/captures/${id}`, {method: 'DELETE'}),
};
