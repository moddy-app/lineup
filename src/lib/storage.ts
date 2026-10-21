/**
 * localStorage and sessionStorage, safely. Storage can throw (private
 * windows, blocked site data, quota) or be missing, and a value can be
 * corrupt: every call falls back instead of breaking the page. Values are
 * JSON.
 */

type Area = 'local' | 'session';

function area(kind: Area): Storage | null {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

/** The stored value, or `fallback` when missing, unreadable or not valid JSON. */
export function getItem<T>(key: string, fallback: T, kind: Area = 'local'): T {
  try {
    const raw = area(kind)?.getItem(key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

/** Returns false when the value could not be stored. */
export function setItem(key: string, value: unknown, kind: Area = 'local'): boolean {
  try {
    const storage = area(kind);
    if (!storage) return false;
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeItem(key: string, kind: Area = 'local'): void {
  try {
    area(kind)?.removeItem(key);
  } catch {
    // Nothing to remove if storage is unavailable.
  }
}

/** Plain strings, stored as they are (no JSON), for keys other code reads too. */
export function getString(key: string, kind: Area = 'local'): string | null {
  try {
    return area(kind)?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function setString(key: string, value: string, kind: Area = 'local'): boolean {
  try {
    const storage = area(kind);
    if (!storage) return false;
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}
