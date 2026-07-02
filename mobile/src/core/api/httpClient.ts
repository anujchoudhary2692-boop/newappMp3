import {getApiBaseUrl, getApiKey, getMediaServerCandidates, getServerCandidates, isProductionMode, setApiBaseUrl} from '../../config';
import {
  connectionErrorHint,
  isReachableHealthStatus,
  loadCachedApiUrl,
  networkErrorMessage,
  orderServerCandidates,
  probeTimeoutFor,
  requestTimeoutMessage,
  saveCachedApiUrl,
} from '../../utils/serverConnection';
import type {ApiResponse} from './types/common';

export type {ApiResponse};

function defaultRequestTimeoutMs(): number {
  return isProductionMode() ? 180000 : 120000;
}

export async function httpRequest<T>(
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

export async function discoverServer(
  candidates = getServerCandidates(),
): Promise<string | null> {
  const apiKey = getApiKey();
  const cached = await loadCachedApiUrl();
  const ordered = orderServerCandidates(candidates, cached);

  for (const base of ordered) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), probeTimeoutFor(base));
      const headers: Record<string, string> = {Accept: 'application/json'};
      if (apiKey) {
        headers['X-API-Key'] = apiKey;
      }
      const response = await fetch(`${base}/api/health`, {
        signal: controller.signal,
        headers,
      });
      clearTimeout(timer);
      const json = await response.json();
      if (
        response.ok &&
        json.success &&
        isReachableHealthStatus(json.data?.status)
      ) {
        setApiBaseUrl(base);
        await saveCachedApiUrl(base);
        return base;
      }
    } catch {
      // try next
    }
  }
  return null;
}

export async function ensureMediaServer(): Promise<string> {
  const candidates = getMediaServerCandidates();
  if (candidates.length > 0) {
    const found = await discoverServer(candidates);
    if (found) {
      return found;
    }
  }
  return getApiBaseUrl();
}

export async function discoverMediaServer(): Promise<string | null> {
  const candidates = getMediaServerCandidates();
  if (candidates.length === 0) {
    return getApiBaseUrl();
  }
  return discoverServer(candidates);
}
