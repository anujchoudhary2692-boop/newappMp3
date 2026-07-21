/**
 * Live deployment — Render backend
 * https://newappmp3.onrender.com
 *
 * API_KEY must match Render env + Docker VITE_API_KEY build arg.
 * Rotate by regenerating openssl rand -hex 24 and updating Render + this file + render.yaml.
 */
export const APP_MODE: 'development' | 'production' = 'production';

/** Render web service URL — no trailing slash */
export const PRODUCTION_API_URL = 'https://newappmp3.onrender.com';

/** Must match backend API_KEY when REQUIRE_API_KEY=true */
export const PRODUCTION_API_KEY = 'c25daa68d397e64c4a7694a53d5c1f4dccfdfee444451287';
