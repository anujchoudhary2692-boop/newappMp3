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
  if (USE_PHYSICAL_DEVICE) {
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

  const hosts = USE_PHYSICAL_DEVICE
    ? [LAN_BACKEND_HOST]
    : Platform.select({
        android: ['10.0.2.2'],
        ios: ['localhost'],
        default: ['localhost'],
      })!;

  return [...new Set(hosts.filter(Boolean))];
}

/** Cloud URL is always tried first — works when your Mac is off. */
export function getServerCandidates(): string[] {
  const candidates: string[] = [];
  const cloud = PRODUCTION_API_URL.replace(/\/$/, '').trim();

  if (cloud && !cloud.includes('yourdomain.com')) {
    candidates.push(cloud);
  }

  if (isProductionMode()) {
    return [...new Set(candidates)];
  }

  const local = getCandidateHosts().map(h => `http://${h}:8080`);
  return [...new Set([...candidates, ...local])];
}

/** Mutable theme tokens — updated by ThemeProvider via applyTheme() */
export const COLORS = {
  background: '#08080E',
  surface: '#12121C',
  surfaceLight: '#1C1C2A',
  primary: '#4F8CFF',
  primaryDark: '#2E6AE0',
  accent: '#22D3EE',
  text: '#F4F4FA',
  textSecondary: '#B4B4CC',
  textMuted: '#707090',
  border: '#2A2A3E',
  danger: '#FF4D6A',
  success: '#34D399',
  warning: '#FBBF24',
  audio: '#4F8CFF',
  video: '#FF5C9A',
  face: '#34D399',
  camera: '#FF9F43',
};

export const GRADIENTS = {
  media: ['#1A1038', '#0F0F14'] as [string, string],
  face: ['#0D2822', '#0F0F14'] as [string, string],
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
