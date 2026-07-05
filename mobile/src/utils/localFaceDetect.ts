import AsyncStorage from '@react-native-async-storage/async-storage';

const OFFLINE_SCAN_KEY = 'mediaface:offlineFacePreScan';

export async function isOfflineFacePreScanEnabled(): Promise<boolean> {
  const v = await AsyncStorage.getItem(OFFLINE_SCAN_KEY);
  return v !== 'false';
}

export async function setOfflineFacePreScanEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(OFFLINE_SCAN_KEY, enabled ? 'true' : 'false');
}

/**
 * Pre-screen images on-device before uploading to the server.
 * Uses ML Kit when available; otherwise uploads everything (server-side scan).
 */
export async function imageLikelyHasFace(imageUri: string): Promise<boolean> {
  const enabled = await isOfflineFacePreScanEnabled();
  if (!enabled) {
    return true;
  }
  try {
    // Optional native module — graceful fallback when not linked
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const FaceDetection = require('@react-native-ml-kit/face-detection').default;
    const faces = await FaceDetection.detect(imageUri, {performanceMode: 'fast'});
    return Array.isArray(faces) && faces.length > 0;
  } catch {
    return true;
  }
}
