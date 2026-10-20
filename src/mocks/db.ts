/**
 * The database in the browser: seeded once, kept in memory, persisted to
 * localStorage (`lineup-mock-db`, versioned) after every write so a reload keeps
 * the changes. Anything unreadable, of another version or older than a week
 * (the seed's dates would have drifted) is replaced by a fresh seed.
 */

import {getItem, removeItem, setItem} from '@/lib/storage';

import {newRuntime, persisted, type Db} from './env';
import {createSeedDb, DB_VERSION} from './seed';

const KEY = 'lineup-mock-db';
const MAX_AGE_MS = 7 * 24 * 3600 * 1000;

interface Stored {
  version: number;
  savedAt: number;
  seededAt: number;
  data: Omit<Db, 'rt'>;
}

let current: Db | null = null;
let seededAt = Date.now();

export function getDb(): Db {
  if (current) return current;
  const stored = getItem<Stored | null>(KEY, null);
  if (stored && stored.version === DB_VERSION && Date.now() - stored.seededAt < MAX_AGE_MS && stored.data?.users) {
    seededAt = stored.seededAt;
    current = {...stored.data, rt: newRuntime()};
  } else {
    current = createSeedDb(new Date());
    seededAt = Date.now();
    saveDb();
  }
  return current;
}

export function saveDb(): void {
  if (!current) return;
  const stored: Stored = {version: DB_VERSION, savedAt: Date.now(), seededAt, data: persisted(current)};
  setItem(KEY, stored);
}

/** Back to the seed. The caller reloads the page so every cache starts clean. */
export function resetDb(): void {
  current = null;
  removeItem(KEY);
}
