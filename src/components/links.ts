/** Profile links: what to show of a URL, and which ones are safe to link. */

import type {Link} from '@/api/types';

/** The host of a web link, without `www.`; null when it is not an http(s) URL. */
export function linkHost(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/** Only web links are rendered as links: a `javascript:` URL in a profile must never become an href. */
export function safeLinks(links: readonly Link[]): Array<Link & {host: string}> {
  return links.flatMap((link) => {
    const host = linkHost(link.url);
    return host ? [{...link, host}] : [];
  });
}
