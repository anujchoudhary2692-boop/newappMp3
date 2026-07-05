export type MediaType = 'AUDIO' | 'VIDEO';

export interface MediaSearchResult {
  videoId: string;
  title: string;
  thumbnailUrl: string;
  channel: string;
  durationSeconds?: number;
  sourceUrl: string;
  audioFormat?: string;
  videoFormat?: string;
  source?: string;
  hasVideo?: boolean;
}

export interface PlayableMedia {
  title: string;
  type: MediaType;
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
  type: MediaType;
  fileName: string;
  streamUrl: string;
  thumbnailUrl: string;
  fileSizeBytes?: number;
  quality?: string;
  durationSeconds?: number;
  downloadedAt?: string;
}

export interface PrepareStatus {
  videoId: string;
  type: MediaType;
  status: 'PREPARING' | 'READY' | 'FAILED';
  streamUrl?: string;
  quality?: string;
  message?: string;
}

export interface MediaDiagnostics {
  ytDlp: string;
  ytDlpVersion?: string;
  ffmpeg: string;
  youtubeCookies: string;
  playDownload: 'UP' | 'LIMITED' | 'DOWN';
}

export interface Person {
  id: string;
  name: string;
  notes?: string;
  photoCount?: number;
}

export interface CaptureItem {
  id: string;
  type: 'PHOTO' | 'VIDEO';
  fileName: string;
  latitude?: number;
  longitude?: number;
  city?: string;
  country?: string;
  capturedAt?: string;
}
