/**
 * Build-time settings (see .env.example). Every value has a default, so the
 * app runs without any .env file.
 */

const trimSlash = (value: string) => value.replace(/\/+$/, '');

export const config = {
  /** The Moddy API; the Lineup routes live under /lineup. */
  apiBase: trimSlash(import.meta.env.VITE_API_BASE || 'https://api.moddy.app'),
  /** Where this site is served. */
  siteUrl: trimSlash(import.meta.env.VITE_SITE_URL || 'https://lineup.moddy.app'),
  /** Development mock API instead of the real one. Never true in production. */
  mockApi: import.meta.env.VITE_MOCK_API === '1' && !import.meta.env.PROD,
} as const;
