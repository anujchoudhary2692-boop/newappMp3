/**
 * Network settings for iOS & Android.
 *
 * Production apps auto-discover the Mac backend via Bonjour (_mediaface._tcp)
 * and always use the cloud URL from production.config.ts — no IP required.
 *
 * LAN_BACKEND_HOST is an optional manual override only (leave empty normally).
 */
export const USE_PHYSICAL_DEVICE = true;

/** Optional manual override — leave empty for automatic Bonjour discovery */
export const LAN_BACKEND_HOST: string = '';
