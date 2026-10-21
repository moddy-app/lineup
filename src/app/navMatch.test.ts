import {describe, expect, it} from 'vitest';

import {isDashboard, isRecruiting, isServers} from './navMatch';

describe('top bar matching', () => {
  it('puts the whole dashboard under one entry', () => {
    for (const path of [
      '/me',
      '/me/experiences',
      '/me/posts',
      '/me/guilds',
      '/posts/new',
      '/posts/abc/edit',
      '/guilds/1/manage',
      '/guilds/1/manage/posts',
    ]) {
      expect(isDashboard(path), path).toBe(true);
      expect(isRecruiting(path), path).toBe(false);
      expect(isServers(path), path).toBe(false);
    }
  });

  it('keeps a post under Recruiting and the directory under Servers', () => {
    expect(isRecruiting('/posts/abc')).toBe(true);
    expect(isRecruiting('/')).toBe(true);
    expect(isServers('/guilds')).toBe(true);
    expect(isServers('/guilds/1')).toBe(true);
    expect(isDashboard('/posts/abc')).toBe(false);
    expect(isDashboard('/guilds/1')).toBe(false);
  });
});
