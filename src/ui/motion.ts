import {useEffect, useState} from 'react';

/** The exit of a popover (lineup.css `popover-out`): short, so a closed menu never lingers. */
export const EXIT_MS = 100;

/** False under `prefers-reduced-motion: reduce`, and where the media query is not known (tests). */
export function allowsMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: no-preference)').matches
  );
}

/**
 * Keeps a popover mounted for its exit animation: `mounted` stays true for
 * `exitMs` after `open` turns false, with `closing` true meanwhile (the
 * element then gets `data-state="closed"` and `inert`). Without motion it
 * unmounts at once.
 */
export function usePresence(open: boolean, exitMs: number = EXIT_MS): {mounted: boolean; closing: boolean} {
  // Set during render when `open` changes (no effect that sets state); cleared by the timer below.
  const [wasOpen, setWasOpen] = useState(open);
  const [closing, setClosing] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    setClosing(!open && allowsMotion());
  }
  useEffect(() => {
    if (!closing) return;
    const timer = window.setTimeout(() => setClosing(false), exitMs);
    return () => window.clearTimeout(timer);
  }, [closing, exitMs]);
  return {mounted: open || closing, closing: closing && !open};
}
