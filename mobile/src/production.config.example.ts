/**
 * Production / live deployment settings.
 *
 * BEFORE RELEASE:
 * 1. Copy this file to production.config.ts
 * 2. Set APP_MODE = 'production'
 * 3. Set PRODUCTION_API_URL to your HTTPS server (e.g. https://api.yourdomain.com)
 * 4. Set PRODUCTION_API_KEY to match API_KEY in server .env
 *
 * Development: keep APP_MODE = 'development' (uses LAN / local.config.ts)
 */
export const APP_MODE: 'development' | 'production' = 'development';

/** Full API base URL — no trailing slash */
/** Render: https://newappmp3.onrender.com — or your custom domain */
export const PRODUCTION_API_URL = 'https://newappmp3.onrender.com';

/** Must match backend API_KEY env var when require-api-key is true */
export const PRODUCTION_API_KEY = '';
