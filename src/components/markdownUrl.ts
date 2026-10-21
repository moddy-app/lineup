/** The only link schemes kept. Anything else (javascript:, data:, relative) is shown as plain text. */
const SAFE_URL = /^(https?:\/\/|mailto:)/i;

export function isSafeUrl(url: string | undefined | null): url is string {
  return typeof url === 'string' && SAFE_URL.test(url.trim());
}
