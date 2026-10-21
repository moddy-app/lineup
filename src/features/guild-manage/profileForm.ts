import type {Catalog, GuildProfile, Link, UpdateGuildBody} from '@/api/types';
import {FIELD_LIMITS} from '@/api/limits';
import {safeHttpsUrl} from '@/lib/url';

/** What the editor holds. Tags are one comma separated text, languages a list of catalog ids. */
export interface ProfileFormValues {
  description: string;
  links: Link[];
  theme: string;
  tags: string;
  languages: string[];
  /** A new invitation; empty keeps the current one. */
  invite: string;
  listed: boolean;
}

/**
 * The profile's `description` falls back to Discord's text. When both are the
 * same the Lineup description is taken as not written: the editor shows an
 * empty field with Discord's text as the hint.
 */
export function lineupDescription(profile: Pick<GuildProfile, 'description' | 'discord_description'>): string {
  const description = profile.description ?? '';
  return description === (profile.discord_description ?? '') ? '' : description;
}

export function valuesFromProfile(profile: GuildProfile): ProfileFormValues {
  return {
    description: lineupDescription(profile),
    links: profile.links.map((link) => ({...link})),
    theme: profile.theme ?? '',
    tags: profile.tags.join(', '),
    languages: [...profile.languages],
    invite: '',
    listed: profile.listed,
  };
}

/** `Minecraft, #survie  RP` gives `['minecraft', 'survie', 'rp']`. */
export function parseTags(text: string): string[] {
  const tags = text
    .split(/[\s,;]+/)
    .map((tag) => tag.replace(/^#/, '').trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(tags)];
}

function cleanLinks(links: readonly Link[]): Link[] {
  return links
    .map((link) => ({label: link.label.trim(), url: link.url.trim()}))
    .filter((link) => link.label !== '' || link.url !== '');
}

const sameList = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && [...a].sort().every((value, index) => value === [...b].sort()[index]);

/** Only the fields that changed: an absent field is not touched by the API. */
export function buildUpdate(baseline: ProfileFormValues, values: ProfileFormValues): UpdateGuildBody {
  const body: UpdateGuildBody = {};

  const before = baseline.description.trim();
  const after = values.description.trim();
  if (before !== after) body.description = after === '' ? null : after;

  const linksBefore = cleanLinks(baseline.links);
  const linksAfter = cleanLinks(values.links);
  if (JSON.stringify(linksBefore) !== JSON.stringify(linksAfter)) body.links = linksAfter;

  if (baseline.theme !== values.theme) body.theme = values.theme === '' ? null : values.theme;

  const tagsAfter = parseTags(values.tags);
  if (!sameList(parseTags(baseline.tags), tagsAfter)) body.tags = tagsAfter;

  if (!sameList(baseline.languages, values.languages)) body.languages = [...values.languages];

  const invite = values.invite.trim();
  if (invite !== '') body.invite = invite;

  if (baseline.listed !== values.listed) body.listed = values.listed;
  return body;
}

export const hasChanges = (body: UpdateGuildBody): boolean => Object.keys(body).length > 0;

/** An i18n key of the `guildManage` namespace (and its parameters) per field. */
export interface LocalIssue {
  key: string;
  params?: Record<string, string | number>;
}

type Limits = Pick<Catalog['limits'], 'max_tags' | 'tag_pattern' | 'max_links' | 'max_languages'>;

/** The checks the form can do before sending; the API checks again. Keys are field paths (`links.0.url`). */
export function validateValues(values: ProfileFormValues, limits: Limits): Record<string, LocalIssue> {
  const issues: Record<string, LocalIssue> = {};

  if (values.description.length > FIELD_LIMITS.guild.descriptionMax) {
    issues.description = {key: 'errors.descriptionMax', params: {count: FIELD_LIMITS.guild.descriptionMax}};
  }

  values.links.forEach((link, index) => {
    const label = link.label.trim();
    const url = link.url.trim();
    if (label === '' && url === '') return;
    if (label === '')
      issues[`links.${index}.label`] = {key: 'errors.linkLabel', params: {max: FIELD_LIMITS.link.labelMax}};
    else if (label.length > FIELD_LIMITS.link.labelMax) {
      issues[`links.${index}.label`] = {key: 'errors.linkLabel', params: {max: FIELD_LIMITS.link.labelMax}};
    }
    if (safeHttpsUrl(url) === null || url.length > FIELD_LIMITS.link.urlMax) {
      issues[`links.${index}.url`] = {key: 'errors.linkUrl'};
    }
  });
  if (cleanLinks(values.links).length > limits.max_links) {
    issues.links = {key: 'errors.linksMax', params: {count: limits.max_links}};
  }

  const tags = parseTags(values.tags);
  let pattern: RegExp | null = null;
  try {
    pattern = new RegExp(limits.tag_pattern);
  } catch {
    pattern = null;
  }
  const bad = pattern ? tags.find((tag) => !pattern.test(tag)) : undefined;
  if (tags.length > limits.max_tags) issues.tags = {key: 'errors.tagsMax', params: {count: limits.max_tags}};
  else if (bad !== undefined) issues.tags = {key: 'errors.tagPattern', params: {tag: bad}};

  if (values.languages.length > limits.max_languages) {
    issues.languages = {key: 'errors.languagesMax', params: {count: limits.max_languages}};
  }

  const invite = values.invite.trim();
  if (invite !== '' && (invite.length < FIELD_LIMITS.guild.inviteMin || invite.length > FIELD_LIMITS.guild.inviteMax)) {
    issues.invite = {key: 'errors.inviteLength'};
  }
  return issues;
}
