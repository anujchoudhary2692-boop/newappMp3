import {Platform, PermissionsAndroid} from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import {VisionCamera} from 'react-native-vision-camera';

export interface GeoLocation {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
  heading?: number;
}

export interface GeoAddress {
  displayName: string;
  city?: string;
  country?: string;
  shortLabel: string;
}

export async function ensureCameraPermissions(videoMode: boolean): Promise<boolean> {
  const camera = await VisionCamera.requestCameraPermission();
  if (!camera) {
    return false;
  }
  if (videoMode) {
    const mic = await VisionCamera.requestMicrophonePermission();
    if (!mic) {
      return false;
    }
  }
  return true;
}

export async function ensureLocationPermission(): Promise<boolean> {
  // Avoid blocking the UI thread with a synchronous authorization probe.
  await new Promise<void>(resolve => setTimeout(resolve, 0));
  if (Platform.OS === 'ios') {
    const auth = await Geolocation.requestAuthorization('whenInUse');
    return auth === 'granted';
  }

  const fine = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  );
  if (fine === PermissionsAndroid.RESULTS.GRANTED) {
    return true;
  }

  const coarse = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
  );
  return coarse === PermissionsAndroid.RESULTS.GRANTED;
}

export function getCurrentLocation(): Promise<GeoLocation> {
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      position => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          altitude: position.coords.altitude ?? undefined,
          accuracy: position.coords.accuracy,
          heading:
            position.coords.heading != null && !Number.isNaN(position.coords.heading)
              ? position.coords.heading
              : undefined,
        });
      },
      error => reject(new Error(error.message || 'Could not get GPS location')),
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 8000,
        forceRequestLocation: true,
        showLocationDialog: true,
      },
    );
  });
}

export function watchLocation(
  onUpdate: (loc: GeoLocation) => void,
): number {
  return Geolocation.watchPosition(
    position => {
      onUpdate({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        altitude: position.coords.altitude ?? undefined,
        accuracy: position.coords.accuracy,
        heading:
          position.coords.heading != null && !Number.isNaN(position.coords.heading)
            ? position.coords.heading
            : undefined,
      });
    },
    () => undefined,
    {
      enableHighAccuracy: true,
      distanceFilter: 3,
      interval: 2000,
      fastestInterval: 1000,
    },
  );
}

export function clearLocationWatch(watchId: number | null | undefined) {
  if (watchId != null) {
    Geolocation.clearWatch(watchId);
  }
}

export async function reverseGeocode(
  latitude: number,
  longitude: number,
): Promise<GeoAddress> {
  const fallback = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
  try {
    const url =
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}` +
      `&lon=${longitude}&zoom=16&addressdetails=1`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'MediaFaceApp/1.0',
      },
    });
    clearTimeout(timer);

    if (!response.ok) {
      throw new Error('Geocode failed');
    }

    const data = await response.json();
    const address = data.address || {};
    const city =
      address.city ||
      address.town ||
      address.village ||
      address.suburb ||
      address.county;
    const country = address.country;
    const shortLabel =
      [city, country].filter(Boolean).join(', ') ||
      data.display_name?.split(',').slice(0, 2).join(', ').trim() ||
      fallback;

    return {
      displayName: data.display_name || shortLabel,
      city,
      country,
      shortLabel,
    };
  } catch {
    return {
      displayName: fallback,
      shortLabel: fallback,
    };
  }
}

export async function resolveCaptureLocation(): Promise<{
  location?: GeoLocation;
  address?: GeoAddress;
}> {
  const allowed = await ensureLocationPermission();
  if (!allowed) {
    return {};
  }

  try {
    const location = await getCurrentLocation();
    const address = await reverseGeocode(location.latitude, location.longitude);
    return {location, address};
  } catch {
    return {};
  }
}
