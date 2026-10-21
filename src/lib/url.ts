/**
 * An https URL as a clean string, or null. A link that comes from the API and
 * is shown as a button must be a web address, never a `javascript:` URL.
 */
export function safeHttpsUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}
