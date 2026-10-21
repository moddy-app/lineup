import {describe, expect, it} from 'vitest';

import {dashboardContext} from './dashboardContext';

describe('dashboardContext', () => {
  it('is the person on their own pages', () => {
    for (const path of ['/me', '/me/experiences', '/me/posts', '/me/guilds', '/posts/abc/edit', '/posts/new']) {
      expect(dashboardContext(path)).toEqual({kind: 'me'});
    }
  });

  it('is the server under /guilds/:id/manage, whatever the page', () => {
    expect(dashboardContext('/guilds/123/manage')).toEqual({kind: 'guild', guildId: '123'});
    expect(dashboardContext('/guilds/123/manage/posts')).toEqual({kind: 'guild', guildId: '123'});
    expect(dashboardContext('/guilds/1%202/manage/settings')).toEqual({kind: 'guild', guildId: '1 2'});
  });

  it('is the server for the editor opened with ?guild=', () => {
    expect(dashboardContext('/posts/new', '?guild=42')).toEqual({kind: 'guild', guildId: '42'});
    expect(dashboardContext('/posts/new', '?kind=user')).toEqual({kind: 'me'});
  });

  it('is not a server on the public profile or on a server named "manage"', () => {
    expect(dashboardContext('/guilds/123')).toEqual({kind: 'me'});
    expect(dashboardContext('/guilds/manage')).toEqual({kind: 'me'});
  });
});
