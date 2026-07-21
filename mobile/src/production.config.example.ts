/**
 * Copy to production.config.ts and fill values for App Store / Play builds.
 *
 * 1. Set APP_MODE = 'production'
 * 2. Set PRODUCTION_API_URL to your Render URL (no trailing slash)
 * 3. Set PRODUCTION_API_KEY to the same API_KEY as the server
 * 4. Set REQUIRE_API_KEY=true on Render
 */
export const APP_MODE: 'development' | 'production' = 'production';

export const PRODUCTION_API_URL = 'https://newappmp3.onrender.com';

/** Must match backend API_KEY env var when require-api-key is true */
export const PRODUCTION_API_KEY = 'c25daa68d397e64c4a7694a53d5c1f4dccfdfee444451287';
