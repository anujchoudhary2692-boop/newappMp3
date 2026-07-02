import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL_KEY = '@mediaface/api_base_url';

export async function loadCachedApiUrl(): Promise<string | null> {
  try {
    const url = await AsyncStorage.getItem(API_URL_KEY);
    if (url && (url.startsWith('https://') || url.startsWith('http://'))) {
      return url.replace(/\/$/, '');
    }
  } catch {
    // ignore
  }
  return null;
}

export async function saveCachedApiUrl(url: string): Promise<void> {
  try {
    await AsyncStorage.setItem(API_URL_KEY, url.replace(/\/$/, ''));
  } catch {
    // ignore
  }
}

export function isReachableHealthStatus(status: unknown): boolean {
  return status === 'UP' || status === 'DEGRADED';
}
