import {read} from '@lodev09/react-native-exify';
import type {GeoLocation} from './location';

function toFileUri(path: string): string {
  return path.startsWith('file://') ? path : `file://${path}`;
}

function parseGpsRef(value: string | undefined, positive: string, negative: string): number {
  return value === negative ? -1 : 1;
}

export async function readPhotoGps(uri: string): Promise<GeoLocation | undefined> {
  try {
    const tags = await read(toFileUri(uri));
    if (!tags?.GPSLatitude || !tags?.GPSLongitude) {
      return undefined;
    }
    const lat = Math.abs(Number(tags.GPSLatitude))
      * parseGpsRef(tags.GPSLatitudeRef, 'N', 'S');
    const lng = Math.abs(Number(tags.GPSLongitude))
      * parseGpsRef(tags.GPSLongitudeRef, 'E', 'W');
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return undefined;
    }
    return {
      latitude: lat,
      longitude: lng,
      altitude: tags.GPSAltitude != null ? Number(tags.GPSAltitude) : undefined,
    };
  } catch {
    return undefined;
  }
}
