/**
 * The age confirmation for adult content, remembered on this device
 * (localStorage `lineup-nsfw-confirmed`). The API never blocks a NSFW server or
 * post: the front shows the gate (LINEUP.md §9). Where storage is unavailable
 * the confirmation lasts until the page is closed.
 */

import {useSyncExternalStore} from 'react';

import type {Badge} from '@/api/types';
import {getItem, removeItem, setItem} from '@/lib/storage';

export const NSFW_STORAGE_KEY = 'lineup-nsfw-confirmed';

const CHANGE_EVENT = 'lineup-nsfw-confirmed';

/** Used when storage refuses the value. */
let memory = false;

export function readNsfwConfirmed(): boolean {
  return memory || getItem<boolean>(NSFW_STORAGE_KEY, false) === true;
}

export function confirmNsfw(): void {
  if (!setItem(NSFW_STORAGE_KEY, true)) memory = true;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Forgets the confirmation (tests, and a future "hide adult content" setting). */
export function resetNsfwConfirmed(): void {
  memory = false;
  removeItem(NSFW_STORAGE_KEY);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(listener: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, listener);
  window.addEventListener('storage', listener);
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    window.removeEventListener('storage', listener);
  };
}

/**
 * Whether the person confirmed being an adult on this device, and the way to
 * record it. Every component using it stays in step (the gate on a page, the
 * feed's "include NSFW" switch, another tab).
 */
export function useNsfwConfirmed(): {confirmed: boolean; confirm: () => void} {
  const confirmed = useSyncExternalStore(subscribe, readNsfwConfirmed, () => false);
  return {confirmed, confirm: confirmNsfw};
}

/** A server or a post is adult content when it has the `nsfw` badge or the `nsfw` theme. */
export function isNsfw(subject: {badges?: readonly Pick<Badge, 'id'>[]; theme?: string | null}): boolean {
  return subject.theme === 'nsfw' || (subject.badges?.some((badge) => badge.id === 'nsfw') ?? false);
}
