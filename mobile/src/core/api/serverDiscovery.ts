import {Platform} from 'react-native';
import Zeroconf from 'react-native-zeroconf';
import {getApiKey, isProductionMode} from '../../config';
import {PRODUCTION_API_URL} from '../../production.config';
import {LAN_BACKEND_HOST} from '../../local.config';
import {isReachableHealthStatus} from '../../utils/serverConnection';
import type {HealthResponse} from './types/common';

const zeroconf = new Zeroconf();
const BONJOUR_TYPE = 'mediaface';
const BONJOUR_PROTOCOL = 'tcp';
const BONJOUR_DOMAIN = 'local.';

export type PlayDownloadStatus = 'UP' | 'LIMITED' | 'DOWN' | 'UNKNOWN';

export interface ServerProbeResult {
  base: string;
  source: 'cloud' | 'bonjour' | 'manual';
  playDownload: PlayDownloadStatus;
  healthStatus: string;
}

function normalizeBase(url: string): string {
  return url.replace(/\/$/, '');
}

function isCloudBase(base: string): boolean {
  const cloud = PRODUCTION_API_URL.replace(/\/$/, '');
  return base.startsWith('https://') || base === cloud || base.includes('onrender.com');
}

function buildManualCandidates(): string[] {
  if (!LAN_BACKEND_HOST || !LAN_BACKEND_HOST.trim()) {
    return [];
  }
  return [normalizeBase(`http://${LAN_BACKEND_HOST.trim()}:8080`)];
}

function buildCloudCandidates(): string[] {
  const cloud = PRODUCTION_API_URL.replace(/\/$/, '').trim();
  if (!cloud || cloud.includes('yourdomain.com')) {
    return [];
  }
  return [cloud];
}

/** Scan local network for MediaFace backends via Bonjour/mDNS (no IP config needed). */
export function scanBonjourServers(timeoutMs = 4500): Promise<string[]> {
  if (Platform.OS === 'web') {
    return Promise.resolve([]);
  }

  return new Promise(resolve => {
    const found = new Map<string, string>();
    let finished = false;

    const finish = () => {
      if (finished) {
        return;
      }
      finished = true;
      clearTimeout(timer);
      try {
        zeroconf.stop();
      } catch {
        // ignore
      }
      zeroconf.removeDeviceListeners?.();
      resolve([...found.values()]);
    };

    const timer = setTimeout(finish, timeoutMs);

    const onResolved = (service: {
      name?: string;
      host?: string;
      addresses?: string[];
      port?: number;
    }) => {
      const host = service.host || service.addresses?.[0];
      if (!host) {
        return;
      }
      const port = service.port || 8080;
      const base = normalizeBase(`http://${host}:${port}`);
      found.set(base, base);
    };

    zeroconf.on('resolved', onResolved);
    zeroconf.on('error', finish);

    try {
      zeroconf.scan(BONJOUR_TYPE, BONJOUR_PROTOCOL, BONJOUR_DOMAIN);
    } catch {
      finish();
    }
  });
}

function isGatewayStatus(status: number): boolean {
  return status === 502 || status === 503 || status === 504;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function probeServerCapabilities(
  base: string,
  timeoutMs = 8000,
): Promise<ServerProbeResult | null> {
  const apiKey = getApiKey();
  try {
    const headers: Record<string, string> = {Accept: 'application/json'};
    if (apiKey) {
      headers['X-API-Key'] = apiKey;
    }

    const tryPath = async (path: string, ms: number) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), ms);
      try {
        const response = await fetch(`${base}${path}`, {
          signal: controller.signal,
          headers,
        });
        if (isGatewayStatus(response.status) || !response.ok || response.status >= 500) {
          return null;
        }
        return (await response.json()) as {success?: boolean; data?: HealthResponse & Record<string, unknown>};
      } catch {
        return null;
      } finally {
        clearTimeout(timer);
      }
    };

    // Prefer /api/live (instant) so cold wake is not blocked by Mongo ping.
    const live = await tryPath('/api/live', Math.min(10000, timeoutMs));
    const liveOk =
      !!live?.success && isReachableHealthStatus((live.data?.status as string) ?? 'UP');

    // Always try health for playDownload when possible (live alone leaves status unknown).
    const health = await tryPath('/api/health', Math.min(liveOk ? 6000 : timeoutMs, timeoutMs));
    if (health?.success && health.data && isReachableHealthStatus(health.data.status)) {
      const playDownload = health.data.media?.playDownload ?? 'DOWN';
      return {
        base,
        source: isCloudBase(base) ? 'cloud' : 'bonjour',
        playDownload,
        healthStatus: health.data.status ?? 'UP',
      };
    }

    if (liveOk) {
      // JVM is up; allow play attempts even if Mongo/health diagnostics timed out.
      return {
        base,
        source: isCloudBase(base) ? 'cloud' : 'bonjour',
        playDownload: 'UP',
        healthStatus: 'UP',
      };
    }

    // Old deploy / partial wake: features endpoint alone proves HTTP is up.
    const features = await tryPath('/api/features', Math.min(8000, timeoutMs));
    if (features?.success && features.data) {
      return {
        base,
        source: isCloudBase(base) ? 'cloud' : 'bonjour',
        playDownload: 'UP',
        healthStatus: 'UP',
      };
    }
    return null;
  } catch {
    return null;
  }
}

/** Poll cloud health through Render 502/503 wake-up (free tier cold start). */
export async function probeCloudServerWithWake(
  base: string,
  maxWaitMs = 180000,
): Promise<ServerProbeResult | null> {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    const remaining = deadline - Date.now();
    const probe = await probeServerCapabilities(base, Math.min(20000, remaining));
    if (probe) {
      return probe;
    }
    if (Date.now() >= deadline) {
      break;
    }
    await sleep(2500);
  }
  return null;
}

export async function collectServerCandidates(
  includeBonjour = true,
): Promise<Array<{base: string; source: ServerProbeResult['source']}>> {
  const seen = new Set<string>();
  const out: Array<{base: string; source: ServerProbeResult['source']}> = [];

  const add = (base: string, source: ServerProbeResult['source']) => {
    const normalized = normalizeBase(base);
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    out.push({base: normalized, source});
  };

  for (const base of buildCloudCandidates()) {
    add(base, 'cloud');
  }

  // Production builds talk only to Render — Mac can be powered off.
  if (!isProductionMode()) {
    if (includeBonjour) {
      const bonjour = await scanBonjourServers();
      for (const base of bonjour) {
        add(base, 'bonjour');
      }
    }
    for (const base of buildManualCandidates()) {
      add(base, 'manual');
    }
  }

  return out;
}

function rankMediaServer(a: ServerProbeResult, b: ServerProbeResult): number {
  const score = (r: ServerProbeResult) => {
    let s = 0;
    if (r.playDownload === 'UP') {
      s += 100;
    } else if (r.playDownload === 'LIMITED' && !isCloudBase(r.base)) {
      s += 80;
    } else if (r.playDownload === 'LIMITED') {
      s += 10;
    }
    if (r.source === 'bonjour') {
      s += 20;
    } else if (r.source === 'manual') {
      s += 15;
    }
    if (r.base.startsWith('http://')) {
      s += 10;
    }
    return s;
  };
  return score(b) - score(a);
}

/** Cloud needs cookies for best results; UNKNOWN/live-only still allows play attempts. */
export function isMediaPlayable(probe: ServerProbeResult): boolean {
  if (probe.playDownload === 'UP' || probe.playDownload === 'UNKNOWN') {
    return true;
  }
  return probe.playDownload === 'LIMITED' && !isCloudBase(probe.base);
}

/** Pick the best reachable server for search/API (cloud preferred for global reach). */
export async function pickBestApiServer(): Promise<ServerProbeResult | null> {
  const candidates = await collectServerCandidates(true);
  const cloudFirst = [
    ...candidates.filter(c => c.source === 'cloud'),
    ...candidates.filter(c => c.source !== 'cloud'),
  ];

  for (const candidate of cloudFirst) {
    const probe =
      candidate.source === 'cloud'
        ? await probeCloudServerWithWake(candidate.base, 180000)
        : await probeServerCapabilities(candidate.base, 5000);
    if (probe) {
      probe.source = candidate.source === 'manual' ? 'manual' : probe.source;
      return probe;
    }
  }
  return null;
}

const STICKY_MEDIA_SERVER_MS = 60_000;
let stickyMediaServer: {result: ServerProbeResult; expiresAt: number} | null = null;

export function invalidateStickyMediaServer(): void {
  stickyMediaServer = null;
}

/** Pick the best server for play/download (full playback capability, auto LAN or cloud). */
export async function pickBestMediaServer(): Promise<ServerProbeResult | null> {
  if (stickyMediaServer && Date.now() < stickyMediaServer.expiresAt) {
    // Drop sticky Mac URL in production — laptop may be off.
    if (isProductionMode() && stickyMediaServer.result.source !== 'cloud') {
      stickyMediaServer = null;
    } else {
      const quick = await probeServerCapabilities(stickyMediaServer.result.base, 3000);
      if (quick && isMediaPlayable(quick)) {
        quick.source = stickyMediaServer.result.source;
        return quick;
      }
      stickyMediaServer = null;
    }
  }

  const candidates = await collectServerCandidates(!isProductionMode());
  const cloudCandidates = candidates.filter(c => c.source === 'cloud');
  const lanCandidates = candidates.filter(c => c.source !== 'cloud');
  // Dev: try LAN first when Mac is on. Production: cloud only.
  const ordered = isProductionMode()
    ? cloudCandidates
    : [...lanCandidates, ...cloudCandidates];

  const probes = (
    await Promise.all(
      ordered.map(async candidate => {
        const probe =
          candidate.source === 'cloud'
            ? await probeCloudServerWithWake(candidate.base, 90000)
            : await probeServerCapabilities(
                candidate.base,
                candidate.source === 'bonjour' ? 5000 : 4000,
              );
        if (!probe) {
          return null;
        }
        probe.source = candidate.source === 'manual' ? 'manual' : probe.source;
        return probe;
      }),
    )
  ).filter((p): p is ServerProbeResult => p != null);

  if (probes.length === 0) {
    return null;
  }

  const playable = probes.filter(isMediaPlayable);
  if (playable.length > 0) {
    playable.sort(rankMediaServer);
    const picked = playable[0]!;
    stickyMediaServer = {result: picked, expiresAt: Date.now() + STICKY_MEDIA_SERVER_MS};
    return picked;
  }

  return null;
}

export function mediaServerUnavailableMessage(): string {
  return (
    'No playback server available.\n\n' +
    '• Anywhere: set YOUTUBE_COOKIES_BASE64 on Render (cloud works on Wi‑Fi or mobile data).\n' +
    '• Same Wi‑Fi: start Mac backend — cd backend && mvn spring-boot:run (auto-discovered, no IP needed).'
  );
}
