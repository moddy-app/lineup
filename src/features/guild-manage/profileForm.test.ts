import {describe, expect, it} from 'vitest';

import type {GuildProfile} from '@/api/types';

import {
  buildUpdate,
  SCOPE_FIELDS,
  hasChanges,
  lineupDescription,
  parseTags,
  validateValues,
  valuesFromProfile,
} from './profileForm';

const profile = {
  description: 'Texte Lineup',
  discord_description: 'Texte Discord',
  links: [{label: 'Site', url: 'https://example.com'}],
  theme: 'gaming',
  tags: ['minecraft', 'survie'],
  languages: ['fr'],
  listed: true,
} as unknown as GuildProfile;

const limits = {max_tags: 10, tag_pattern: '^[a-z0-9-]{2,24}$', max_links: 5, max_languages: 10};

describe('profile form', () => {
  it('sends nothing when nothing changed', () => {
    const base = valuesFromProfile(profile);
    expect(hasChanges(buildUpdate(base, {...base}))).toBe(false);
  });

  it('sends only the changed fields, and null to clear', () => {
    const base = valuesFromProfile(profile);
    const body = buildUpdate(base, {...base, description: '  ', theme: '', tags: 'Minecraft, #rp', listed: false});
    expect(body).toEqual({description: null, theme: null, tags: ['minecraft', 'rp'], listed: false});
  });

  it('sends links as a whole, dropping empty rows, and [] to empty them', () => {
    const base = valuesFromProfile(profile);
    expect(buildUpdate(base, {...base, links: [...base.links, {label: '', url: ''}]})).toEqual({});
    expect(buildUpdate(base, {...base, links: []})).toEqual({links: []});
  });

  it('treats a description equal to Discord is as unwritten', () => {
    expect(lineupDescription({description: 'Texte Discord', discord_description: 'Texte Discord'})).toBe('');
  });

  it('parses tags', () => {
    expect(parseTags('A, b  #c;a')).toEqual(['a', 'b', 'c']);
  });

  it('validates links, tags and the invitation', () => {
    const base = valuesFromProfile(profile);
    const issues = validateValues(
      {...base, links: [{label: '', url: 'http://x.com'}], tags: 'ok, Bad Tag!, x', invite: 'a'},
      limits,
    );
    expect(Object.keys(issues).sort()).toEqual(['invite', 'links.0.label', 'links.0.url', 'tags']);
  });

  it('sends only the fields of the page it is built for', () => {
    const base = valuesFromProfile(profile);
    const edited = {...base, description: 'Autre', theme: '', invite: 'abc-def', listed: false};
    expect(buildUpdate(base, edited, 'profile')).toEqual({description: 'Autre', theme: null});
    expect(buildUpdate(base, edited, 'invite')).toEqual({invite: 'abc-def'});
    expect(buildUpdate(base, edited, 'visibility')).toEqual({listed: false});
    expect(buildUpdate(base, edited)).toEqual({description: 'Autre', theme: null, invite: 'abc-def', listed: false});
  });

  it('checks only the fields of the page', () => {
    const base = valuesFromProfile(profile);
    const bad = {...base, tags: 'Bad Tag!', invite: 'a'};
    expect(Object.keys(validateValues(bad, limits, 'profile'))).toEqual(['tags']);
    expect(Object.keys(validateValues(bad, limits, 'invite'))).toEqual(['invite']);
    expect(validateValues(bad, limits, 'visibility')).toEqual({});
  });

  it('gives each field to exactly one page', () => {
    const all = Object.values(SCOPE_FIELDS).flat();
    expect(new Set(all).size).toBe(all.length);
    expect(all.sort()).toEqual(Object.keys(valuesFromProfile(profile)).sort());
  });
});
