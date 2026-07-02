import {Platform} from 'react-native';
import Zeroconf from 'react-native-zeroconf';
import {getApiKey} from '../../config';
import {PRODUCTION_API_URL} from '../../production.config';
import {LAN_BACKEND_HOST} from '../../local.config';
import {isReachableHealthStatus} from '../../utils/serverConnection';
import type {HealthResponse} from './types/common';

const zeroconf = new Zeroconf();
const BONJOUR_TYPE = 'mediaface';
const BONJOUR_PROTOCOL = 'tcp';
const BONJOUR_DOMAIN = 'local.';

export type PlayDownloadStatus = 'UP' | 'LIMITED' | 'DOWN';

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

export async function probeServerCapabilities(
  base: string,
  timeoutMs = 8000,
): Promise<ServerProbeResult | null> {
  const apiKey = getApiKey();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const headers: Record<string, string> = {Accept: 'application/json'};
    if (apiKey) {
      headers['X-API-Key'] = apiKey;
    }
    const response = await fetch(`${base}/api/health`, {
      signal: controller.signal,
      headers,
    });
    clearTimeout(timer);

    if (!response.ok || response.status >= 500) {
      return null;
    }

    const json = (await response.json()) as {success?: boolean; data?: HealthResponse};
    if (!json.success || !json.data || !isReachableHealthStatus(json.data.status)) {
      return null;
    }

    const playDownload = json.data.media?.playDownload ?? 'DOWN';
    return {
      base,
      source: isCloudBase(base) ? 'cloud' : 'bonjour',
      playDownload,
      healthStatus: json.data.status ?? 'UP',
    };
  } catch {
    return null;
  }
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

  if (includeBonjour) {
    const bonjour = await scanBonjourServers();
    for (const base of bonjour) {
      add(base, 'bonjour');
    }
  }

  for (const base of buildManualCandidates()) {
    add(base, 'manual');
  }

  return out;
}

function rankMediaServer(a: ServerProbeResult, b: ServerProbeResult): number {
  const score = (r: ServerProbeResult) => {
    let s = 0;
    if (r.playDownload === 'UP') {
      s += 100;
    } else if (r.playDownload === 'LIMITED') {
      s += 40;
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

/** Pick the best reachable server for search/API (cloud preferred for global reach). */
export async function pickBestApiServer(): Promise<ServerProbeResult | null> {
  const candidates = await collectServerCandidates(true);
  const cloudFirst = [
    ...candidates.filter(c => c.source === 'cloud'),
    ...candidates.filter(c => c.source !== 'cloud'),
  ];

  for (const candidate of cloudFirst) {
    const probe = await probeServerCapabilities(candidate.base, candidate.source === 'cloud' ? 90000 : 5000);
    if (probe) {
      probe.source = candidate.source === 'manual' ? 'manual' : probe.source;
      return probe;
    }
  }
  return null;
}

/** Pick the best server for play/download (full playback capability, auto LAN or cloud). */
export async function pickBestMediaServer(): Promise<ServerProbeResult | null> {
  const candidates = await collectServerCandidates(true);
  const probes = (
    await Promise.all(
      candidates.map(async candidate => {
        const timeout =
          candidate.source === 'cloud' ? 90000 : candidate.source === 'bonjour' ? 5000 : 4000;
        const probe = await probeServerCapabilities(candidate.base, timeout);
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

  const playable = probes.filter(p => p.playDownload === 'UP');
  if (playable.length > 0) {
    playable.sort(rankMediaServer);
    return playable[0]!;
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
