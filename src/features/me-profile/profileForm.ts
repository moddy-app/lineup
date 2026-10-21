/** The profile editor's form: its state, its checks and the body of a save (LINEUP.md §6.3, §4 "Autres limites"). */

import type {Link, UpdateProfileBody, UserProfile} from '@/api/types';

export const HEADLINE_MAX = 120;
export const BIO_MAX = 2000;
export const LINKS_MAX = 5;
export const LINK_LABEL_MAX = 40;
export const LINK_URL_MAX = 500;
export const LANGUAGES_MAX = 10;
export const TIMEZONE_MAX = 64;

export interface ProfileFormState {
  headline: string;
  bio: string;
  links: Link[];
  languages: string[];
  timezone: string;
  open_to_work: boolean;
}

/** A problem with a field: a key of the `meProfile` namespace (`errors.<key>`) and its number, if any. */
export interface FieldProblem {
  key:
    | 'linkLabelRequired'
    | 'linkLabelTooLong'
    | 'urlInvalid'
    | 'urlHttps'
    | 'urlTooLong'
    | 'timezoneInvalid'
    | 'tooLong'
    | 'tooMany';
  count?: number;
}

export type ProfileProblems = Record<string, FieldProblem>;

export function formFromProfile(
  profile: Pick<UserProfile, 'headline' | 'bio' | 'links' | 'languages' | 'timezone' | 'open_to_work'>,
): ProfileFormState {
  return {
    headline: profile.headline ?? '',
    bio: profile.bio ?? '',
    links: profile.links.map((link) => ({label: link.label, url: link.url})),
    languages: [...profile.languages],
    timezone: profile.timezone ?? '',
    open_to_work: profile.open_to_work,
  };
}

const UTC_OFFSET = /^UTC[+-](0\d|1[0-4]):[0-5]\d$/;

/** An IANA zone the browser knows, or `UTC±HH:MM` (hours 00 to 14, minutes 00 to 59). */
export function isValidTimezone(value: string): boolean {
  if (value.length === 0 || value.length > TIMEZONE_MAX) return false;
  if (UTC_OFFSET.test(value)) return true;
  if (!/^[A-Za-z][A-Za-z0-9_+-]*(\/[A-Za-z0-9_+-]+)*$/.test(value)) return false;
  try {
    new Intl.DateTimeFormat('en', {timeZone: value});
    return true;
  } catch {
    return false;
  }
}

/** The browser's own zone, when it is one the API accepts. */
export function browserTimezone(): string | null {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return zone && isValidTimezone(zone) ? zone : null;
  } catch {
    return null;
  }
}

/** `https` only, 500 characters at most, no credentials, no spaces, port 443 or none. */
export function linkUrlProblem(value: string): FieldProblem['key'] | null {
  const url = value.trim();
  if (url.length === 0) return 'urlInvalid';
  if (url.length > LINK_URL_MAX) return 'urlTooLong';
  if (/\s/.test(url)) return 'urlInvalid';
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return 'urlInvalid';
  }
  if (parsed.protocol !== 'https:') return 'urlHttps';
  if (parsed.username || parsed.password) return 'urlInvalid';
  if (parsed.port && parsed.port !== '443') return 'urlInvalid';
  return null;
}

export function validateProfile(state: ProfileFormState): ProfileProblems {
  const problems: ProfileProblems = {};
  if (state.headline.length > HEADLINE_MAX) problems.headline = {key: 'tooLong', count: HEADLINE_MAX};
  if (state.bio.length > BIO_MAX) problems.bio = {key: 'tooLong', count: BIO_MAX};
  if (state.links.length > LINKS_MAX) problems.links = {key: 'tooMany', count: LINKS_MAX};
  if (state.languages.length > LANGUAGES_MAX) problems.languages = {key: 'tooMany', count: LANGUAGES_MAX};
  state.links.forEach((link, index) => {
    const label = link.label.trim();
    if (label.length === 0) problems[`links.${index}.label`] = {key: 'linkLabelRequired'};
    else if (label.length > LINK_LABEL_MAX)
      problems[`links.${index}.label`] = {key: 'linkLabelTooLong', count: LINK_LABEL_MAX};
    const urlProblem = linkUrlProblem(link.url);
    if (urlProblem) problems[`links.${index}.url`] = {key: urlProblem};
  });
  const timezone = state.timezone.trim();
  if (timezone && !isValidTimezone(timezone)) problems.timezone = {key: 'timezoneInvalid'};
  return problems;
}

const sameLinks = (a: readonly Link[], b: readonly Link[]) =>
  a.length === b.length && a.every((link, i) => link.label === b[i]?.label && link.url === b[i]?.url);

const sameList = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((v, i) => v === b[i]);

/** The text fields are trimmed; an empty one is a `null` (clear). */
function clean(state: ProfileFormState): ProfileFormState {
  return {
    ...state,
    headline: state.headline.trim(),
    bio: state.bio.trim(),
    timezone: state.timezone.trim(),
    links: state.links.map((link) => ({label: link.label.trim(), url: link.url.trim()})),
  };
}

/** Only what changed since `initial`; `null` clears headline, bio and timezone and nothing else. */
export function profileChanges(initial: ProfileFormState, current: ProfileFormState): UpdateProfileBody {
  const before = clean(initial);
  const after = clean(current);
  const body: UpdateProfileBody = {};
  if (after.headline !== before.headline) body.headline = after.headline || null;
  if (after.bio !== before.bio) body.bio = after.bio || null;
  if (!sameLinks(after.links, before.links)) body.links = after.links;
  if (!sameList(after.languages, before.languages)) body.languages = after.languages;
  if (after.timezone !== before.timezone) body.timezone = after.timezone || null;
  if (after.open_to_work !== before.open_to_work) body.open_to_work = after.open_to_work;
  return body;
}

export const hasChanges = (initial: ProfileFormState, current: ProfileFormState) =>
  Object.keys(profileChanges(initial, current)).length > 0;
