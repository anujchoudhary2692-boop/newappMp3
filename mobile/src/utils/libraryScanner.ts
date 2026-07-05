import {Platform, PermissionsAndroid} from 'react-native';
import {CameraRoll, PhotoIdentifier} from '@react-native-camera-roll/camera-roll';
import {api} from '../api/client';
import {extractVideoFrames} from './videoFrames';

const PAGE_SIZE = 50;
const CONCURRENCY = 2;

export type ScanMode = 'photos' | 'videos' | 'all';

export interface ScanProgress {
  scanned: number;
  found: number;
  photos: number;
  videos: number;
  groupMatches: number;
}

export interface ScanOptions {
  personId: string;
  mode: ScanMode;
  onProgress: (progress: ScanProgress) => void;
  shouldCancel: () => boolean;
  knownDeviceIds?: Set<string>;
  onMatch?: (result: {confidence: number; groupPhoto?: boolean}) => void;
}

async function requestLibraryPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    const img = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
    );
    const vid = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO,
    );
    return (
      img === PermissionsAndroid.RESULTS.GRANTED ||
      vid === PermissionsAndroid.RESULTS.GRANTED
    );
  }
  try {
    await CameraRoll.getPhotos({first: 1, assetType: 'All'});
    return true;
  } catch {
    return false;
  }
}

function assetTypeForMode(mode: ScanMode): 'Photos' | 'Videos' | 'All' {
  if (mode === 'photos') return 'Photos';
  if (mode === 'videos') return 'Videos';
  return 'All';
}

async function scanOneImage(
  personId: string,
  uri: string,
  devicePhotoId: string,
  iosAssetId: string | undefined,
  sourceType: 'PHOTO' | 'VIDEO',
  sourceTimestampMs?: number,
  onMatch?: ScanOptions['onMatch'],
): Promise<{saved: boolean; groupPhoto?: boolean}> {
  const {imageLikelyHasFace} = await import('./localFaceDetect');
  if (!(await imageLikelyHasFace(uri))) {
    return {saved: false};
  }
  const {readPhotoGps} = await import('./exifLocation');
  const {reverseGeocode} = await import('./location');
  const gps = await readPhotoGps(uri);
  let geo: {latitude?: number; longitude?: number; address?: string; city?: string; country?: string} | undefined;
  if (gps) {
    const address = await reverseGeocode(gps.latitude, gps.longitude);
    geo = {
      latitude: gps.latitude,
      longitude: gps.longitude,
      address: address.displayName,
      city: address.city,
      country: address.country,
    };
  }
  const response = await api.scanLibraryPhoto(
    personId,
    uri,
    devicePhotoId,
    iosAssetId,
    sourceType,
    sourceTimestampMs,
    geo,
  );
  if (response.success && response.data?.matched && response.data.saved) {
    onMatch?.({confidence: response.data.confidence, groupPhoto: response.data.groupPhoto});
    return {saved: true, groupPhoto: response.data.groupPhoto};
  }
  return {saved: false};
}

async function processAsset(
  personId: string,
  edge: PhotoIdentifier,
  knownDeviceIds: Set<string>,
  onMatch?: ScanOptions['onMatch'],
): Promise<{scanned: number; found: number; photos: number; videos: number; groupMatches: number}> {
  const node = edge.node;
  const isVideo = node.type?.startsWith('video') || node.type === 'video';
  const assetId = node.id;
  const baseUri = node.image.uri;
  let scanned = 0;
  let found = 0;
  let photos = 0;
  let videos = 0;
  let groupMatches = 0;

  if (isVideo) {
    videos += 1;
    const duration = node.image.playableDuration ?? 30;
    const frames = await extractVideoFrames(baseUri, duration, assetId);

    for (const frame of frames) {
      const devicePhotoId = `${assetId}@${frame.timestampMs}`;
      if (knownDeviceIds.has(devicePhotoId)) {
        scanned += 1;
        continue;
      }

      try {
        const result = await scanOneImage(
          personId,
          frame.uri,
          devicePhotoId,
          assetId,
          'VIDEO',
          frame.timestampMs,
          onMatch,
        );
        if (result.saved) {
          found += 1;
          knownDeviceIds.add(devicePhotoId);
          if (result.groupPhoto) {
            groupMatches += 1;
          }
        }
      } catch {
        // skip
      }
      scanned += 1;
    }
  } else {
    photos += 1;
    const devicePhotoId = assetId || baseUri;
    if (knownDeviceIds.has(devicePhotoId)) {
      scanned += 1;
      return {scanned, found, photos, videos, groupMatches};
    }

    try {
      const result = await scanOneImage(
        personId,
        baseUri,
        devicePhotoId,
        assetId,
        'PHOTO',
        undefined,
        onMatch,
      );
      if (result.saved) {
        found += 1;
        knownDeviceIds.add(devicePhotoId);
        if (result.groupPhoto) {
          groupMatches += 1;
        }
      }
    } catch {
      // skip
    }
    scanned += 1;
  }

  return {scanned, found, photos, videos, groupMatches};
}

/** Scan device library for a registered person (photos, videos, group shots). */
export async function scanPersonLibrary(options: ScanOptions): Promise<ScanProgress> {
  const allowed = await requestLibraryPermission();
  if (!allowed) {
    throw new Error('Photo library access is required');
  }

  const knownDeviceIds = new Set(options.knownDeviceIds ?? []);
  const progress: ScanProgress = {
    scanned: 0,
    found: 0,
    photos: 0,
    videos: 0,
    groupMatches: 0,
  };

  let cursor: string | undefined;
  const assetType = assetTypeForMode(options.mode);

  while (!options.shouldCancel()) {
    const page = await CameraRoll.getPhotos({
      first: PAGE_SIZE,
      after: cursor,
      assetType,
      include: ['filename', 'fileSize', 'playableDuration'],
    });

    if (page.edges.length === 0) {
      break;
    }

    const batch: PhotoIdentifier[] = [];
    for (const edge of page.edges) {
      if (options.shouldCancel()) {
        break;
      }
      batch.push(edge);
    }

    for (let i = 0; i < batch.length; i += CONCURRENCY) {
      if (options.shouldCancel()) {
        break;
      }
      const chunk = batch.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        chunk.map(edge => processAsset(options.personId, edge, knownDeviceIds, options.onMatch)),
      );
      for (const r of results) {
        progress.scanned += r.scanned;
        progress.found += r.found;
        progress.photos += r.photos;
        progress.videos += r.videos;
        progress.groupMatches += r.groupMatches;
      }
      options.onProgress({...progress});
    }

    if (!page.page_info.has_next_page) {
      break;
    }
    cursor = page.page_info.end_cursor;
  }

  return progress;
}

export {requestLibraryPermission};
