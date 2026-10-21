import {describe, expect, it} from 'vitest';

import {paths} from './paths';

describe('paths.postNew', () => {
  it('has no query by default', () => {
    expect(paths.postNew()).toBe('/posts/new');
  });

  it('preselects the kind', () => {
    expect(paths.postNew('user')).toBe('/posts/new?kind=user');
    expect(paths.postNew('guild')).toBe('/posts/new?kind=guild');
  });
});

describe('paths.postNew with options', () => {
  it('takes a kind, a server, or both, encoded', () => {
    expect(paths.postNew({kind: 'user'})).toBe('/posts/new?kind=user');
    expect(paths.postNew({guildId: '1 2'})).toBe('/posts/new?guild=1%202');
    expect(paths.postNew({kind: 'guild', guildId: '9'})).toBe('/posts/new?kind=guild&guild=9');
    expect(paths.postNew({})).toBe('/posts/new');
  });
});

describe('server management paths', () => {
  it('has one page per section, ids encoded', () => {
    expect(paths.guildManage('a/b')).toBe('/guilds/a%2Fb/manage');
    expect(paths.guildManageInvite('1')).toBe('/guilds/1/manage/invite');
    expect(paths.guildManagePosts('1')).toBe('/guilds/1/manage/posts');
    expect(paths.guildManageDiscord('1')).toBe('/guilds/1/manage/discord');
    expect(paths.guildManageSettings('a b')).toBe('/guilds/a%20b/manage/settings');
  });
});
