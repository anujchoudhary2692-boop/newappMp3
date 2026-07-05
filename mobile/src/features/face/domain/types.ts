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
  sourceType?: 'PHOTO' | 'VIDEO' | 'CAPTURE' | 'CAPTURE_VIDEO' | 'MEDIA_VIDEO' | 'SCAN' | string;
  sourceTimestampMs?: number;
  facesDetected?: number;
  groupPhoto?: boolean;
  matchedFaceIndex?: number;
  captureId?: string;
  mediaVideoId?: string;
  mediaTitle?: string;
  latitude?: number;
  longitude?: number;
  locationLabel?: string;
}

export interface PersonTimelineEntry extends PersonPhoto {
  personName?: string;
  playbackUrl?: string;
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
