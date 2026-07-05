import {getApiBaseUrl, getApiKey, getServerCandidates, isProductionMode, setApiBaseUrl} from '../../config';
import {
  clearCachedApiUrl,
  connectionErrorHint,
  isRecoverableRequestError,
  loadCachedApiUrl,
  networkErrorMessage,
  orderServerCandidates,
  probeTimeoutFor,
  requestTimeoutMessage,
  saveCachedApiUrl,
  isReachableHealthStatus,
  type ServerOrderMode,
} from '../../utils/serverConnection';
import {
  mediaServerUnavailableMessage,
  pickBestApiServer,
  pickBestMediaServer,
  probeCloudServerWithWake,
  probeServerCapabilities,
  scanBonjourServers,
} from './serverDiscovery';
import type {ApiResponse} from './types/common';

export type {ApiResponse};

function defaultRequestTimeoutMs(): number {
  return isProductionMode() ? 180000 : 120000;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function probeServerHealth(base: string, timeoutMs = probeTimeoutFor(base)): Promise<boolean> {
  if (base.startsWith('https://')) {
    const probe = await probeCloudServerWithWake(base, timeoutMs);
    return probe != null;
  }
  const probe = await probeServerCapabilities(base, timeoutMs);
  return probe != null;
}

async function executeHttpRequest<T>(
  path: string,
  options: RequestInit = {},
  timeoutMs = defaultRequestTimeoutMs(),
): Promise<ApiResponse<T>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const base = getApiBaseUrl();
  const apiKey = getApiKey();

  try {
    const response = await fetch(`${base}${path}`, {
      ...options,
      signal: options.signal ?? controller.signal,
      headers: {
        Accept: 'application/json',
        ...(apiKey ? {'X-API-Key': apiKey} : {}),
        ...(options.body instanceof FormData
          ? {}
          : {'Content-Type': 'application/json'}),
        ...(options.headers as Record<string, string>),
      },
    });

    const text = await response.text();
    if (
      !response.ok &&
      (response.status === 502 || response.status === 503 || response.status === 504)
    ) {
      throw new Error(
        `Server error (${response.status}). ${connectionErrorHint()}`,
      );
    }

    let json: ApiResponse<T>;
    try {
      json = text ? JSON.parse(text) : {success: false, message: 'Empty response', data: null as T};
    } catch {
      throw new Error(
        response.ok
          ? 'Invalid server response'
          : `Server error (${response.status}). ${connectionErrorHint()}`,
      );
    }

    if (!response.ok) {
      throw new Error(json.message || `Request failed (${response.status})`);
    }
    return json;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(requestTimeoutMessage());
    }
    if (error instanceof Error && error.message === 'Network request failed') {
      throw new Error(networkErrorMessage(base));
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function httpRequest<T>(
  path: string,
  options: RequestInit = {},
  timeoutMs = defaultRequestTimeoutMs(),
): Promise<ApiResponse<T>> {
  try {
    return await executeHttpRequest<T>(path, options, timeoutMs);
  } catch (error) {
    if (!isRecoverableRequestError(error) || options.signal?.aborted) {
      throw error;
    }
    await clearCachedApiUrl();
    if (isProductionMode()) {
      await wakeCloudServer(120000);
    } else {
      await discoverServer(getServerCandidates());
    }
    await sleep(1500);
    return executeHttpRequest<T>(path, options, timeoutMs);
  }
}

export async function discoverServer(
  candidates = getServerCandidates(),
  mode: ServerOrderMode = 'cloud-first',
): Promise<string | null> {
  const cached = await loadCachedApiUrl();
  const ordered = orderServerCandidates(candidates, cached, mode);

  for (const base of ordered) {
    if (await probeServerHealth(base)) {
      setApiBaseUrl(base);
      await saveCachedApiUrl(base);
      return base;
    }
  }
  return null;
}

/** Auto-discover LAN backend via Bonjour (no IP configuration). */
export async function discoverLanMediaServer(): Promise<string | null> {
  const bonjour = await scanBonjourServers();
  for (const base of bonjour) {
    if (await probeServerHealth(base, 5000)) {
      setApiBaseUrl(base);
      await saveCachedApiUrl(base);
      return base;
    }
  }
  return null;
}

/** Ensure a reachable API server — cloud or LAN, works on Wi‑Fi and mobile data. */
export async function ensureApiServer(): Promise<string | null> {
  const picked = await pickBestApiServer();
  if (picked) {
    setApiBaseUrl(picked.base);
    await saveCachedApiUrl(picked.base);
    return picked.base;
  }

  const fallback = await discoverServer(getServerCandidates());
  if (fallback) {
    return fallback;
  }

  return null;
}

/** Ensure the best server for play/download — prefers full playback capability. */
export async function ensureMediaServer(): Promise<string> {
  const picked = await pickBestMediaServer();
  if (picked) {
    setApiBaseUrl(picked.base);
    await saveCachedApiUrl(picked.base);
    return picked.base;
  }
  throw new Error(mediaServerUnavailableMessage());
}

export async function discoverMediaServer(): Promise<string | null> {
  try {
    return await ensureMediaServer();
  } catch {
    return null;
  }
}

/** Wake Render free tier by polling health until UP or timeout. */
export async function wakeCloudServer(timeoutMs = 180000): Promise<boolean> {
  const cloud = getServerCandidates().find(c => c.startsWith('https://'));
  if (!cloud) {
    return false;
  }

  const probe = await probeCloudServerWithWake(cloud, timeoutMs);
  if (probe) {
    setApiBaseUrl(probe.base);
    await saveCachedApiUrl(probe.base);
    return true;
  }
  return false;
}

export {pickBestApiServer, pickBestMediaServer, scanBonjourServers, probeServerCapabilities};
