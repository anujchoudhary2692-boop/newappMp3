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
  audioStreamUrl?: string;
  videoStreamUrl?: string;
  source?: string;
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

export interface PlayUrlResponse {
  videoId: string;
  type: MediaType;
  streamUrl: string;
  contentType: string;
  quality?: string;
  cached: boolean;
}

export interface PrepareStatusResponse {
  videoId: string;
  type: MediaType;
  status: 'PREPARING' | 'READY' | 'FAILED';
  streamUrl?: string;
  contentType?: string;
  quality?: string;
  message?: string;
}

export interface MediaDiagnostics {
  ytDlp: 'UP' | 'DOWN';
  ytDlpVersion?: string;
  ffmpeg: 'UP' | 'DOWN';
  youtubeCookies: 'CONFIGURED' | 'MISSING';
  playDownload: 'UP' | 'LIMITED' | 'DOWN';
  cacheDirWritable?: boolean;
  hints?: Record<string, string>;
}

export interface DownloadPayload {
  videoId: string;
  title: string;
  sourceUrl: string;
  type: MediaType;
  quality?: string;
}
