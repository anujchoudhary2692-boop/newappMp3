import {Platform} from 'react-native';
import {LAN_BACKEND_HOST, USE_PHYSICAL_DEVICE} from './local.config';
import {
  APP_MODE,
  PRODUCTION_API_KEY,
  PRODUCTION_API_URL,
} from './production.config';

export function isProductionMode(): boolean {
  return APP_MODE === 'production' && PRODUCTION_API_URL.trim().length > 0;
}

export function getApiKey(): string {
  return isProductionMode() ? PRODUCTION_API_KEY.trim() : '';
}

function devDefaultHost(): string {
  if (USE_PHYSICAL_DEVICE && LAN_BACKEND_HOST) {
    return LAN_BACKEND_HOST;
  }
  return Platform.select({
    android: '10.0.2.2',
    ios: 'localhost',
    default: 'localhost',
  })!;
}

function initialApiBaseUrl(): string {
  if (isProductionMode()) {
    return PRODUCTION_API_URL.replace(/\/$/, '');
  }
  return `http://${devDefaultHost()}:8080`;
}

let apiBaseUrl = initialApiBaseUrl();

export function getApiBaseUrl(): string {
  return apiBaseUrl;
}

export function setApiBaseUrl(url: string): void {
  apiBaseUrl = url.replace(/\/$/, '');
}

/** @deprecated use getApiBaseUrl() — kept for display; updates when server is discovered */
export function getApiBaseUrlLabel(): string {
  return getApiBaseUrl();
}

export function getCandidateHosts(): string[] {
  if (isProductionMode()) {
    return [];
  }

  const hosts = USE_PHYSICAL_DEVICE && LAN_BACKEND_HOST
    ? [LAN_BACKEND_HOST]
    : Platform.select({
        android: ['10.0.2.2'],
        ios: ['localhost'],
        default: ['localhost'],
      })!;

  return [...new Set(hosts.filter(Boolean))];
}

/** Cloud + optional manual LAN override — Bonjour discovery adds LAN at runtime. */
export function getServerCandidates(): string[] {
  const candidates: string[] = [];
  const cloud = PRODUCTION_API_URL.replace(/\/$/, '').trim();

  if (cloud && !cloud.includes('yourdomain.com')) {
    candidates.push(cloud);
  }

  if (isProductionMode()) {
    if (USE_PHYSICAL_DEVICE && LAN_BACKEND_HOST) {
      candidates.push(`http://${LAN_BACKEND_HOST}:8080`);
    }
    return [...new Set(candidates)];
  }

  const local = getCandidateHosts().map(h => `http://${h}:8080`);
  return [...new Set([...candidates, ...local])];
}

/** Legacy list — prefer pickBestMediaServer() for play/download. */
export function getMediaServerCandidates(): string[] {
  return getServerCandidates();
}

/** Mutable theme tokens — updated by ThemeProvider via applyTheme() */
export const COLORS = {
  background: '#0F1117',
  surface: '#161D26',
  surfaceLight: '#232F3E',
  primary: '#FF9900',
  primaryDark: '#E88B00',
  accent: '#007185',
  text: '#FFFFFF',
  textSecondary: '#C7CED4',
  textMuted: '#879596',
  border: '#232F3E',
  danger: '#FF4D6A',
  success: '#067D62',
  warning: '#FBBF24',
  audio: '#FF9900',
  video: '#FF6B9D',
  face: '#34D399',
  camera: '#FF9F43',
};

export const GRADIENTS = {
  media: ['#131921', '#0F1117'] as [string, string],
  face: ['#131921', '#0F1117'] as [string, string],
  playerAudio: ['#1A1038', '#12082A', '#0F0F14'] as [string, string, string],
  playerVideo: ['#2A1033', '#1A0A22', '#0F0F14'] as [string, string, string],
  camera: ['#2A1810', '#1A1208', '#0F0F14'] as [string, string, string],
};

export function applyTheme(theme: {
  colors: typeof COLORS;
  gradients: typeof GRADIENTS;
}): void {
  Object.assign(COLORS, theme.colors);
  Object.assign(GRADIENTS, theme.gradients);
}

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const RADIUS = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 24,
};

export const SHADOW = {
  sm: {
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 3,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 8,
  },
};
