import {beforeEach, describe, expect, it} from 'vitest';

import {getDb, resetDb, saveDb} from './db';
import {currentSession, getPersonaId, PERSONAS, setPersonaId} from './personas';
import {U} from './seed/ids';
import {DEFAULT_SETTINGS, getSettings, takeFailNext, updateSettings} from './settings';

beforeEach(() => {
  window.localStorage.clear();
  resetDb();
});

describe('the persisted database', () => {
  it('seeds once, persists under lineup-mock-db and survives a reload', () => {
    const db = getDb();
    expect(window.localStorage.getItem('lineup-mock-db')).not.toBeNull();
    const post = Object.values(db.posts)[0];
    if (!post) throw new Error('no post');
    post.title = 'Changed by the test';
    saveDb();
    const stored = JSON.parse(window.localStorage.getItem('lineup-mock-db') ?? '{}');
    expect(stored.version).toBe(1);
    expect(stored.data).not.toHaveProperty('rt');
    // A "reload": the in-memory copy is dropped and read back.
    resetDbMemoryOnly();
    expect(getDb().posts[post.id]?.title).toBe('Changed by the test');
  });

  it('throws away a stored database of another version, or an unreadable one', () => {
    getDb();
    window.localStorage.setItem(
      'lineup-mock-db',
      JSON.stringify({version: 999, seededAt: Date.now(), data: {users: {}}}),
    );
    resetDbMemoryOnly();
    expect(Object.keys(getDb().users).length).toBeGreaterThan(10);
    window.localStorage.setItem('lineup-mock-db', '{not json');
    resetDbMemoryOnly();
    expect(Object.keys(getDb().users).length).toBeGreaterThan(10);
  });

  it('resets to the seed', () => {
    const db = getDb();
    const id = Object.keys(db.posts)[0] ?? '';
    delete db.posts[id];
    saveDb();
    resetDb();
    expect(getDb().posts[id]).toBeDefined();
  });
});

/** Forget the in-memory copy without erasing the stored one. */
function resetDbMemoryOnly() {
  const raw = window.localStorage.getItem('lineup-mock-db');
  resetDb();
  if (raw !== null) window.localStorage.setItem('lineup-mock-db', raw);
}

describe('personas and settings', () => {
  it('is anonymous by default and remembers the persona in lineup-mock-persona', () => {
    expect(getPersonaId()).toBe('anonymous');
    expect(currentSession()).toBeNull();
    setPersonaId('dashboard');
    expect(window.localStorage.getItem('lineup-mock-persona')).toBe('dashboard');
    expect(currentSession()).toEqual({userId: U.camille, hasLineupScopes: false});
    setPersonaId('member');
    expect(currentSession()).toEqual({userId: U.camille, hasLineupScopes: true});
    window.localStorage.setItem('lineup-mock-persona', 'garbage');
    expect(getPersonaId()).toBe('anonymous');
  });

  it('has the six personas of the brief', () => {
    expect(PERSONAS.map((persona) => persona.id)).toEqual([
      'anonymous',
      'member',
      'dashboard',
      'staff',
      'suspended',
      'newcomer',
    ]);
  });

  it('keeps the toggles, with 300 ms of latency by default, and consumes "fail next" once', () => {
    expect(getSettings()).toMatchObject(DEFAULT_SETTINGS);
    expect(getSettings().latency).toBe(300);
    updateSettings({discordDown: true, latency: 1200});
    expect(JSON.parse(window.localStorage.getItem('lineup-mock-settings') ?? '{}')).toMatchObject({
      discordDown: true,
      latency: 1200,
    });
    updateSettings({failNext: true});
    expect(takeFailNext()).toBe(true);
    expect(takeFailNext()).toBe(false);
  });
});
