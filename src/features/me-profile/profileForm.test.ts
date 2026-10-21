import {describe, expect, it} from 'vitest';

import {
  formFromProfile,
  isValidTimezone,
  linkUrlProblem,
  profileChanges,
  type ProfileFormState,
  validateProfile,
} from './profileForm';

const base: ProfileFormState = {
  headline: 'Modératrice',
  bio: 'Texte',
  links: [{label: 'Site', url: 'https://alex.example.com'}],
  languages: ['fr'],
  timezone: 'Europe/Paris',
  open_to_work: true,
};

describe('profileChanges', () => {
  it('sends nothing when nothing changed', () => {
    expect(profileChanges(base, {...base})).toEqual({});
  });

  it('sends only the changed fields', () => {
    expect(profileChanges(base, {...base, languages: ['fr', 'en'], open_to_work: false})).toEqual({
      languages: ['fr', 'en'],
      open_to_work: false,
    });
  });

  it('clears headline, bio and timezone with null, never links or languages', () => {
    const body = profileChanges(base, {...base, headline: '  ', bio: '', timezone: '', links: [], languages: []});
    expect(body).toEqual({headline: null, bio: null, timezone: null, links: [], languages: []});
  });

  it('trims text', () => {
    expect(profileChanges(base, {...base, headline: ' Hello '})).toEqual({headline: 'Hello'});
  });
});

describe('validation', () => {
  it('accepts https links on the default port only', () => {
    expect(linkUrlProblem('https://example.com/a')).toBeNull();
    expect(linkUrlProblem('https://example.com:443/a')).toBeNull();
    expect(linkUrlProblem('http://example.com')).toBe('urlHttps');
    expect(linkUrlProblem('https://example.com:8443')).toBe('urlInvalid');
    expect(linkUrlProblem('https://user:pw@example.com')).toBe('urlInvalid');
    expect(linkUrlProblem('https://exa mple.com')).toBe('urlInvalid');
    expect(linkUrlProblem('example.com')).toBe('urlInvalid');
    expect(linkUrlProblem(`https://example.com/${'a'.repeat(500)}`)).toBe('urlTooLong');
  });

  it('accepts IANA zones and UTC offsets', () => {
    expect(isValidTimezone('Europe/Paris')).toBe(true);
    expect(isValidTimezone('UTC+02:00')).toBe(true);
    expect(isValidTimezone('UTC-14:59')).toBe(true);
    expect(isValidTimezone('UTC+15:00')).toBe(false);
    expect(isValidTimezone('UTC+02:60')).toBe(false);
    expect(isValidTimezone('Mars/Olympus')).toBe(false);
    expect(isValidTimezone('')).toBe(false);
  });

  it('reports each field', () => {
    const problems = validateProfile({
      ...base,
      headline: 'x'.repeat(121),
      links: [{label: '', url: 'http://a.b'}],
      timezone: 'nope',
    });
    expect(Object.keys(problems).sort()).toEqual(['headline', 'links.0.label', 'links.0.url', 'timezone']);
    expect(validateProfile(base)).toEqual({});
  });
});

describe('formFromProfile', () => {
  it('turns nulls into empty strings', () => {
    const form = formFromProfile({
      headline: null,
      bio: null,
      links: [],
      languages: [],
      timezone: null,
      open_to_work: false,
    });
    expect(form.headline).toBe('');
    expect(form.timezone).toBe('');
  });
});
