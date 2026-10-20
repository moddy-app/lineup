/**
 * Client-side navigation for links that React Router does not render:
 * the kit's logo (an <a> inside the app bar's shadow DOM), an md-menu-item or
 * md-*-button with `href` (an <a> inside their shadow DOM). Their click would
 * reload the page, so a click listener on the element finds the real anchor
 * with composedPath() and navigates through the router instead.
 */

import type {NavigateFunction} from 'react-router';

/**
 * The anchor this click should turn into a client-side navigation, or null when
 * the browser must handle it (new tab, download, other site, in-page anchor…).
 */
export function internalAnchor(event: MouseEvent): HTMLAnchorElement | null {
  if (event.defaultPrevented || event.button !== 0) return null;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;

  const anchor = event.composedPath().find((node): node is HTMLAnchorElement => node instanceof HTMLAnchorElement);
  if (!anchor?.href) return null;
  if (anchor.target && anchor.target !== '_self') return null;
  if (anchor.hasAttribute('download') || anchor.getAttribute('rel')?.split(' ').includes('external')) return null;

  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin) return null;
  // A link to a spot of the current page (the skip link): the browser scrolls and focuses it.
  if (url.hash && url.pathname === window.location.pathname && url.search === window.location.search) return null;
  return anchor;
}

/** A click listener that navigates through the router when it can. */
export function clientNavigation(navigate: NavigateFunction) {
  return (event: MouseEvent) => {
    const anchor = internalAnchor(event);
    if (!anchor) return;
    event.preventDefault();
    const url = new URL(anchor.href, window.location.href);
    void navigate(url.pathname + url.search + url.hash);
  };
}
