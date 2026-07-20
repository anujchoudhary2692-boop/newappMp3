import AsyncStorage from '@react-native-async-storage/async-storage';
import {getApiBaseUrl, isProductionMode} from '../config';
import {PRODUCTION_API_URL} from '../production.config';

const API_URL_KEY = '@mediaface/api_base_url';

export async function loadCachedApiUrl(): Promise<string | null> {
  try {
    const url = await AsyncStorage.getItem(API_URL_KEY);
    if (url && (url.startsWith('https://') || url.startsWith('http://'))) {
      const normalized = url.replace(/\/$/, '');
      // Production builds must not stick to a Mac LAN IP when the laptop is off.
      if (isProductionMode() && isLanBase(normalized)) {
        await AsyncStorage.removeItem(API_URL_KEY);
        return null;
      }
      return normalized;
    }
  } catch {
    // ignore
  }
  return null;
}

export async function saveCachedApiUrl(url: string): Promise<void> {
  try {
    const normalized = url.replace(/\/$/, '');
    if (isProductionMode() && isLanBase(normalized)) {
      return;
    }
    await AsyncStorage.setItem(API_URL_KEY, normalized);
  } catch {
    // ignore
  }
}

export async function clearCachedApiUrl(): Promise<void> {
  try {
    await AsyncStorage.removeItem(API_URL_KEY);
  } catch {
    // ignore
  }
}

/** Cloud first for search/API; LAN first for play/download when Mac is available. */
export type ServerOrderMode = 'cloud-first' | 'lan-first';

function isLanBase(base: string): boolean {
  return (
    base.startsWith('http://192.168.') ||
    base.startsWith('http://10.') ||
    base.startsWith('http://172.')
  );
}

export function orderServerCandidates(
  candidates: string[],
  cached: string | null,
  mode: ServerOrderMode = 'cloud-first',
): string[] {
  const cloud = PRODUCTION_API_URL.replace(/\/$/, '').trim();
  const unique = (urls: string[]) =>
    [...new Set(urls.filter(u => u && u.length > 0))];

  if (isProductionMode()) {
    const cloudList =
      cloud && !cloud.includes('yourdomain.com') ? [cloud] : [];
    const httpsCached =
      cached && cached.startsWith('https://') && cached !== cloud ? [cached] : [];
    // Never prefer LAN in production — phone must work with Mac powered off.
    return unique([...cloudList, ...httpsCached]);
  }

  if (cached) {
    return unique([cached, ...candidates.filter(c => c !== cached)]);
  }
  return unique(candidates);
}

/** Shorter timeout for LAN; longer for cloud (Render cold start). */
export function probeTimeoutFor(base: string): number {
  if (base.startsWith('https://')) {
    return isProductionMode() ? 180000 : 45000;
  }
  return 6000;
}

export function isReachableHealthStatus(status: unknown): boolean {
  return status === 'UP' || status === 'DEGRADED';
}

function isCloudBase(base: string): boolean {
  return base.startsWith('https://') || base.includes('onrender.com');
}

/** User-facing hint when API calls fail — reflects the server URL in use. */
export function connectionErrorHint(): string {
  const base = getApiBaseUrl();
  if (isCloudBase(base)) {
    return (
      'Cloud server is waking up or temporarily unavailable (502). Check internet (Wi‑Fi or mobile data) ' +
      'and wait up to 3 minutes — Render free tier sleeps when idle. Your Mac does not need to be on.'
    );
  }
  if (base.startsWith('http://192.168.') || base.startsWith('http://10.') || base.startsWith('http://172.')) {
    return (
      'Cannot reach a nearby MediaFace backend. Start it on your Mac with: cd backend && mvn spring-boot:run ' +
      '(same Wi‑Fi, Local Network enabled). No IP address needs to be configured.'
    );
  }
  return (
    'Cannot reach the backend. Start it with: cd backend && mvn spring-boot:run (port 8080), ' +
    'same Wi‑Fi, Local Network enabled — or use cloud mode in production.config.ts.'
  );
}

export function networkErrorMessage(base = getApiBaseUrl()): string {
  if (isCloudBase(base)) {
    return (
      `Cannot reach ${base}. Check internet. Render free tier may sleep — wait ~2 min and retry.`
    );
  }
  return (
    `Cannot reach ${base}. Same Wi‑Fi as Mac? Enable Local Network in iPhone Settings.`
  );
}

export function requestTimeoutMessage(): string {
  if (isCloudBase(getApiBaseUrl())) {
    return 'Request timed out. Cloud server may be waking up — wait up to 3 min and try again.';
  }
  return 'Request timed out. Check that the backend is running on your Mac.';
}

export function isRecoverableRequestError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const msg = error.message.toLowerCase();
  return (
    msg.includes('server error (502)') ||
    msg.includes('server error (503)') ||
    msg.includes('server error (504)') ||
    msg.includes('network request failed') ||
    msg.includes('timed out') ||
    msg.includes('invalid server response') ||
    msg.includes('empty response') ||
    msg.includes('cannot reach')
  );
}
