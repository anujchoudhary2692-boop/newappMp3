export interface CaptureItem {
  id: string;
  type: 'PHOTO' | 'VIDEO';
  fileName: string;
  fileUrl: string;
  thumbnailUrl?: string;
  latitude?: number;
  longitude?: number;
  altitude?: number;
  gpsAccuracy?: number;
  address?: string;
  city?: string;
  country?: string;
  locationLabel?: string;
  capturedAt?: string;
  durationMs?: number;
  scanStatus?: string;
  matchCount?: number;
  heading?: number;
  trackPointsJson?: string;
}

export interface CaptureUploadPayload {
  fileUri: string;
  fileName: string;
  mimeType: string;
  type: 'PHOTO' | 'VIDEO';
  latitude?: number;
  longitude?: number;
  altitude?: number;
  gpsAccuracy?: number;
  address?: string;
  city?: string;
  country?: string;
  durationMs?: number;
  clientCapturedAt?: string;
  heading?: number;
  trackPointsJson?: string;
}
