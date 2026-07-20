/**
 * Network settings for iOS & Android.
 *
 * Production (APP_MODE=production): phone uses Render cloud only.
 * MacBook can be fully powered off — no LAN / Bonjour required.
 *
 * Development: optional LAN_BACKEND_HOST for physical device testing
 * against a Mac backend on the same Wi‑Fi.
 */
export const USE_PHYSICAL_DEVICE = true;

/** Optional manual LAN override for development only — leave empty normally */
export const LAN_BACKEND_HOST: string = '';
