/** Resolved API origin — empty string means same-host relative URLs (/api/...). */
export function getApiBase(): string {
  try {
    const override = localStorage.getItem('mediaface:apiUrl');
    if (override?.trim()) return override.trim().replace(/\/$/, '');
  } catch {
    // private browsing / SSR
  }
  const env = import.meta.env.VITE_API_URL;
  if (env && String(env).trim()) return String(env).trim().replace(/\/$/, '');
  return '';
}

export function getApiBaseLabel(): string {
  const base = getApiBase();
  if (base) return base;
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin} (same host)`;
  }
  return 'same host';
}

export function getApiKey(): string {
  try {
    const override = localStorage.getItem('mediaface:apiKey');
    if (override?.trim()) return override.trim();
  } catch {
    // ignore
  }
  return (import.meta.env.VITE_API_KEY || '').trim();
}

/** @deprecated use getApiBase() */
export const API_BASE = getApiBase();

/** @deprecated use getApiKey() */
export const API_KEY = getApiKey();

export const COLORS = {
  bg: '#0F1117',
  surface: '#1A1D26',
  surface2: '#242836',
  border: '#2E3344',
  text: '#F0F2F8',
  textSecondary: '#9BA3B8',
  textMuted: '#6B7289',
  primary: '#FF9900',
  primaryDark: '#CC7A00',
  audio: '#7C5CFF',
  video: '#00C2FF',
  danger: '#FF4D6A',
  success: '#22C55E',
};
