import {describe, expect, it} from 'vitest';

import {catalogFixture} from '@/api/catalog.fixture';
import {makePost} from '@/api/fixtures';

import {
  EMPTY_FORM,
  emptyRequirement,
  expiryBounds,
  expiryInstant,
  type FormState,
  formFromPost,
  isValidHttpsUrl,
  isValidTimezone,
  mapServerIssues,
  normalizeTag,
  stepOfField,
  toCreateBody,
  toUpdateBody,
  validateAll,
  validateStep,
} from './form';

const catalog = catalogFixture;
const now = new Date(2026, 9, 20, 10, 0, 0);
const rules = {catalog, now};

const valid = (patch: Partial<FormState> = {}): FormState => ({
  ...EMPTY_FORM,
  kind: 'user',
  title: 'Je cherche une équipe',
  description: 'Modérateur depuis trois ans, disponible le soir.',
  positions: ['moderator'],
  ...patch,
});

describe('validateStep', () => {
  it('checks the title and description against the catalog limits', () => {
    const issues = validateStep('content', {...EMPTY_FORM, title: 'abc', description: 'x'.repeat(4001)}, rules, false);
    expect(issues.title).toEqual({message: 'tooShort', params: {count: 5}});
    expect(issues.description).toEqual({message: 'tooLong', params: {count: 4000}});
  });

  it('asks for free labels only when "other" is chosen', () => {
    expect(validateStep('positions', valid({positions: ['moderator']}), rules, false)).toEqual({});
    const issues = validateStep('positions', valid({positions: ['other'], positionsOther: ['']}), rules, false);
    expect(issues['positionsOther.0']?.message).toBe('required');
    expect(validateStep('positions', valid({positions: ['other']}), rules, false).positionsOther?.message).toBe(
      'otherRequired',
    );
  });

  it('limits positions to 5', () => {
    const ids = ['moderator', 'admin', 'support', 'developer', 'manager', 'communication'];
    expect(validateStep('positions', valid({positions: ids}), rules, false).positions?.message).toBe('positionsMax');
  });

  it('adapts a requirement to its value type', () => {
    const age = {...emptyRequirement('min_age'), text: '12'};
    expect(validateStep('requirements', valid({requirements: [age]}), rules, false)['requirements.0.value']).toEqual({
      message: 'between',
      params: {min: 13, max: 99},
    });
    const custom = {...emptyRequirement('custom'), text: 'Savoir utiliser Moddy'};
    expect(validateStep('requirements', valid({requirements: [custom]}), rules, false)['requirements.0.label']).toEqual({
      message: 'required',
      params: undefined,
    });
    const langs = emptyRequirement('languages');
    expect(validateStep('requirements', valid({requirements: [langs]}), rules, false)['requirements.0.value']?.message).toBe(
      'languagesMin',
    );
    expect(validateStep('requirements', valid({requirements: [emptyRequirement('voice_required')]}), rules, false)).toEqual({});
  });

  it('requires an https URL for an external application', () => {
    const base = valid({applicationType: 'external_url'});
    expect(validateStep('application', base, rules, false)['application.url']?.message).toBe('required');
    expect(validateStep('application', {...base, applicationUrl: 'http://x.fr'}, rules, false)['application.url']?.message).toBe(
      'urlHttps',
    );
    expect(validateStep('application', {...base, applicationUrl: 'https://forms.example.com/a'}, rules, false)).toEqual({});
    expect(validateStep('application', valid({applicationType: 'lineup_form'}), rules, false).application?.message).toBe(
      'formUnavailable',
    );
  });

  it('checks the commitment ranges, the zone and the tags', () => {
    const issues = validateStep('commitment', valid({hours: '169', openings: '0', timezone: 'Mars/Base'}), rules, false);
    expect(issues['commitment.hours_per_week']?.message).toBe('between');
    expect(issues['commitment.openings']?.message).toBe('between');
    expect(issues.timezone?.message).toBe('timezone');
    expect(validateStep('extras', valid({tags: ['ok-tag', 'Bad Tag']}), rules, false)['tags.1']?.message).toBe('tag');
  });

  it('bounds the expiry between tomorrow and 180 days', () => {
    const {min, max} = expiryBounds(now, 180);
    expect(min).toBe('2026-10-21');
    expect(max).toBe('2027-04-18');
    expect(validateStep('extras', valid({expiresOn: '2026-10-20'}), rules, false).expiresOn?.message).toBe('expiryMin');
    expect(validateStep('extras', valid({expiresOn: '2027-04-19'}), rules, false).expiresOn?.message).toBe('expiryMax');
    expect(validateStep('extras', valid({expiresOn: max}), rules, false)).toEqual({});
    expect(validateStep('extras', valid({expiresOn: '2026-10-01'}), {...rules, unchangedExpiry: '2026-10-01'}, false)).toEqual({});
  });

  it('forbids a featured experience on a server post and an unverified one', () => {
    expect(validateStep('extras', valid({kind: 'guild', featuredExperienceId: 'e1'}), rules, false).featuredExperienceId?.message).toBe(
      'featuredUserOnly',
    );
    expect(
      validateStep('extras', valid({featuredExperienceId: 'e1'}), {...rules, verifiedExperienceIds: ['e2']}, false)
        .featuredExperienceId?.message,
    ).toBe('featuredNotVerified');
  });

  it('needs a claimed server for a server post', () => {
    const form = valid({kind: 'guild', guildId: '1'});
    expect(validateStep('type', form, {...rules, claimedGuildIds: ['2']}, false).guildId?.message).toBe('guildNotClaimed');
    expect(validateStep('type', form, {...rules, claimedGuildIds: ['1']}, false)).toEqual({});
    expect(validateStep('type', EMPTY_FORM, rules, true)).toEqual({});
  });

  it('is valid as a whole for a complete form', () => {
    expect(validateAll(valid(), rules, false)).toEqual({});
  });
});

describe('bodies', () => {
  it('builds a creation body without empty optional fields', () => {
    const body = toCreateBody(valid(), catalog, now, 'draft');
    expect(body).toMatchObject({kind: 'user', status: 'draft', timezone: null, commitment: null, application: null, expires_at: null});
    expect('guild_id' in body).toBe(false);
  });

  it('puts guild_id on a server post and the commitment, application and requirements in the right shape', () => {
    const form = valid({
      kind: 'guild',
      guildId: '812',
      hours: '5',
      compensation: 'volunteer',
      applicationType: 'discord_dm',
      requirements: [{...emptyRequirement('account_age_days'), text: '180', verified: true}, {...emptyRequirement('verified_experience')}],
    });
    const body = toCreateBody(form, catalog, now, 'published');
    expect(body.guild_id).toBe('812');
    expect(body.commitment).toEqual({hours_per_week: 5, compensation: 'volunteer'});
    expect(body.application).toEqual({type: 'discord_dm'});
    expect(body.requirements).toEqual([
      {type: 'account_age_days', value: 180, verified_by_lineup: true},
      {type: 'verified_experience', verified_by_lineup: false},
    ]);
  });

  it('never sends verified_by_lineup for a requirement that cannot be checked', () => {
    const body = toCreateBody(valid({requirements: [{...emptyRequirement('voice_required'), verified: true}]}), catalog, now, 'draft');
    expect(body.requirements).toEqual([{type: 'voice_required', value: true, verified_by_lineup: false}]);
  });

  it('puts the expiry at the end of the chosen day, never past the API bound', () => {
    expect(expiryInstant('2026-11-01', now, 180)).toBe(new Date(2026, 10, 1, 23, 59).toISOString());
    const limit = expiryInstant(expiryBounds(now, 180).max, now, 180)!;
    expect(+new Date(limit)).toBeLessThan(+now + 180 * 86_400_000);
  });

  it('sends only the changed fields, and null to clear a nullable one', () => {
    const post = makePost({
      kind: 'user',
      guild_id: null,
      timezone: 'Europe/Paris',
      theme: 'gaming',
      commitment: {hours_per_week: 5, compensation: null, openings: null},
      expires_at: new Date(2026, 11, 1, 23, 59).toISOString(),
    });
    const form = formFromPost(post);
    expect(toUpdateBody(form, post, catalog, now)).toEqual({});
    const cleared = {...form, timezone: '', theme: '', hours: '', expiresOn: '', title: 'Nouveau titre'};
    expect(toUpdateBody(cleared, post, catalog, now)).toEqual({
      title: 'Nouveau titre',
      timezone: null,
      theme: null,
      commitment: null,
      expires_at: null,
    });
  });

  it('does not resend an unchanged expiry', () => {
    const post = makePost({expires_at: '2026-12-01T00:00:00+00:00', is_expired: false});
    const form = {...formFromPost(post), tags: ['abc']};
    expect(toUpdateBody(form, post, catalog, now)).toEqual({tags: ['abc']});
  });
});

describe('server errors', () => {
  it('maps a loc to its field and step', () => {
    const mapped = mapServerIssues([
      {type: 'string_too_short', loc: ['body', 'title'], msg: ''},
      {type: 'value_error', loc: ['body', 'requirements', 2, 'value'], msg: ''},
      {type: 'value_error', loc: ['body', 'positions_other', 0], msg: ''},
      {type: 'value_error', loc: ['body', 'expires_at'], msg: ''},
      {type: 'value_error', loc: ['body', 'commitment', 'openings'], msg: ''},
      {type: 'value_error', loc: ['body', 'status'], msg: ''},
    ]);
    expect(mapped.map((entry) => [entry.field, entry.step])).toEqual([
      ['title', 'content'],
      ['requirements.2.value', 'requirements'],
      ['positionsOther.0', 'positions'],
      ['expiresOn', 'extras'],
      ['commitment.openings', 'commitment'],
      ['status', 'review'],
    ]);
    expect(stepOfField('guildId')).toBe('type');
  });
});

describe('small rules', () => {
  it('normalizes tags', () => expect(normalizeTag('  #Survie ')).toBe('survie'));
  it('accepts IANA zones and UTC offsets only', () => {
    expect(isValidTimezone('Europe/Paris')).toBe(true);
    expect(isValidTimezone('UTC+02:00')).toBe(true);
    expect(isValidTimezone('UTC+15:00')).toBe(false);
    expect(isValidTimezone('UTC+02:75')).toBe(false);
    expect(isValidTimezone('Paris time')).toBe(false);
  });
  it('accepts https URLs without credentials', () => {
    expect(isValidHttpsUrl('https://a.example/x?y=1')).toBe(true);
    expect(isValidHttpsUrl('https://user:pw@a.example')).toBe(false);
    expect(isValidHttpsUrl('https://a.example:8443')).toBe(false);
    expect(isValidHttpsUrl('javascript:alert(1)')).toBe(false);
  });
});
