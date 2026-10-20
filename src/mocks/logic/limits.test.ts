import {describe, expect, it} from 'vitest';

import {catalogFixture} from '@/api/catalog.fixture';

import {G, U} from '../seed/ids';
import {createTestApi, NOW, type TestResponse} from '../testing';
import {iso} from '../time';

/**
 * LINEUP.md section 4 ("Autres limites") and the catalog's `limits`, at the boundary and one step beyond,
 * through the routes that apply them. A valid value must not be refused (201 or 200), an invalid one must be a
 * standard 422 (shape 4) that points at the field.
 */

const A = (n: number, char = 'a') => char.repeat(n);
const POST = {kind: 'user', title: 'Titre valide', description: A(30), positions: ['moderator']};
const day = (n: number) => new Date(NOW.getTime() + n * 86_400_000).toISOString();

type Case = [label: string, value: unknown, ok: boolean];

async function runPost(patch: Record<string, unknown>) {
  const api = createTestApi('ines');
  return api.call('POST', '/lineup/posts', {body: {...POST, ...patch}});
}

async function expectCases(field: string, cases: Case[], run: (value: unknown) => Promise<TestResponse>) {
  for (const [label, value, ok] of cases) {
    const response = await run(value);
    if (ok) {
      expect([response.status < 300, label, response.json?.detail?.[0]?.msg], `${field}: ${label}`).toEqual([
        true,
        label,
        undefined,
      ]);
    } else {
      expect(response.status, `${field}: ${label}`).toBe(422);
      expect(response.json.error, `${field}: ${label}`).toBe('Validation error');
      expect(
        response.json.detail.some((issue: {loc: Array<string | number>}) => issue.loc[1] === field),
        `${field}: ${label} -> ${JSON.stringify(response.json.detail)}`,
      ).toBe(true);
    }
  }
}

describe('post limits (§4)', () => {
  it('title 5 to 100 and description 20 to 4000', async () => {
    await expectCases(
      'title',
      [
        ['4', A(4), false],
        ['5', A(5), true],
        ['100', A(100), true],
        ['101', A(101), false],
        ['number', 42, false],
      ],
      (value) => runPost({title: value}),
    );
    await expectCases(
      'description',
      [
        ['19', A(19), false],
        ['20', A(20), true],
        ['4000', A(4000), true],
        ['4001', A(4001), false],
      ],
      (value) => runPost({description: value}),
    );
  });

  it('positions 1 to 5, from the catalog, without duplicates', async () => {
    const ids = catalogFixture.positions.map((entry) => entry.id as string);
    await expectCases(
      'positions',
      [
        ['none', [], false],
        ['5', ids.slice(0, 5).filter((id) => id !== 'other'), true],
        ['6', ids.slice(0, 6), false],
        ['unknown', ['pilot'], false],
        ['duplicate', ['moderator', 'moderator'], false],
        ['not a list', 'moderator', false],
      ],
      (value) => runPost({positions: value}),
    );
  });

  it('positions_other: 0 to 3 labels of 1 to 40 characters, required if and only if `other` is a position', async () => {
    await expectCases(
      'positions_other',
      [
        ['1 label', ['Gestion de bots'], true],
        ['3 labels', ['a', 'b', 'c'], true],
        ['4 labels', ['a', 'b', 'c', 'd'], false],
        ['40 characters', [A(40)], true],
        ['41 characters', [A(41)], false],
        ['empty label', [''], false],
        ['missing', undefined, false],
      ],
      (value) => runPost({positions: ['moderator', 'other'], ...(value === undefined ? {} : {positions_other: value})}),
    );
    await expectCases('positions_other', [['unexpected', ['x'], false]], (value) =>
      runPost({positions: ['moderator'], positions_other: value}),
    );
  });

  it('requirements: 15 at most, each valid for its catalog type', async () => {
    const many = (n: number) => Array.from({length: n}, () => ({type: 'voice_required', value: true}));
    await expectCases(
      'requirements',
      [
        ['15', many(15), true],
        ['16', many(16), false],
      ],
      (value) => runPost({requirements: value}),
    );
    const rule = (label: string, requirement: Record<string, unknown>, ok: boolean): Case => [label, [requirement], ok];
    await expectCases(
      'requirements',
      [
        rule('min_age 13', {type: 'min_age', value: 13}, true),
        rule('min_age 99', {type: 'min_age', value: 99}, true),
        rule('min_age 12', {type: 'min_age', value: 12}, false),
        rule('min_age 100', {type: 'min_age', value: 100}, false),
        rule('min_age text', {type: 'min_age', value: 'seize'}, false),
        rule('min_age float', {type: 'min_age', value: 16.5}, false),
        rule('account_age_days 0', {type: 'account_age_days', value: 0}, true),
        rule('account_age_days 3650', {type: 'account_age_days', value: 3650, verified_by_lineup: true}, true),
        rule('account_age_days 3651', {type: 'account_age_days', value: 3651}, false),
        rule('experience_months 240', {type: 'experience_months', value: 240}, true),
        rule('experience_months 241', {type: 'experience_months', value: 241}, false),
        rule('availability_hours 1', {type: 'availability_hours', value: 1}, true),
        rule('availability_hours 0', {type: 'availability_hours', value: 0}, false),
        rule('availability_hours 168', {type: 'availability_hours', value: 168}, true),
        rule('availability_hours 169', {type: 'availability_hours', value: 169}, false),
        rule('server_activity 200', {type: 'server_activity', value: A(200)}, true),
        rule('server_activity 201', {type: 'server_activity', value: A(201)}, false),
        rule('server_activity empty', {type: 'server_activity', value: ''}, false),
        rule('voice_required bool', {type: 'voice_required', value: false}, true),
        rule('voice_required text', {type: 'voice_required', value: 'oui'}, false),
        rule('languages', {type: 'languages', value: ['fr', 'en']}, true),
        rule('languages empty', {type: 'languages', value: []}, false),
        rule('languages unknown', {type: 'languages', value: ['xx']}, false),
        rule('verified_experience no value', {type: 'verified_experience', verified_by_lineup: true}, true),
        rule('verified_experience with a value', {type: 'verified_experience', value: 1}, false),
        rule('custom with label', {type: 'custom', value: 'Savoir utiliser Moddy', label: 'Outils'}, true),
        rule('custom without label', {type: 'custom', value: 'Savoir utiliser Moddy'}, false),
        rule('custom label 80', {type: 'custom', value: 'x', label: A(80)}, true),
        rule('custom label 81', {type: 'custom', value: 'x', label: A(81)}, false),
        rule('custom text 200', {type: 'custom', value: A(200), label: 'x'}, true),
        rule('custom text 201', {type: 'custom', value: A(201), label: 'x'}, false),
        rule(
          'verified_by_lineup on a declarative type',
          {type: 'experience_months', value: 3, verified_by_lineup: true},
          false,
        ),
        rule('verified_by_lineup on min_age (future)', {type: 'min_age', value: 16, verified_by_lineup: true}, true),
        rule('unknown type', {type: 'height', value: 180}, false),
      ],
      (value) => runPost({requirements: value}),
    );
  });

  it('languages: 10 ids of the catalog at most; tags: 10 at most, ^[a-z0-9-]{2,24}$, lower-cased and trimmed', async () => {
    const languages = catalogFixture.languages.map((entry) => entry.id as string);
    await expectCases(
      'languages',
      [
        ['10', languages.slice(0, 10), true],
        ['11', languages.slice(0, 11), false],
        ['unknown', ['xx'], false],
      ],
      (value) => runPost({languages: value}),
    );
    const tags = (n: number) => Array.from({length: n}, (_, index) => `tag-${index}`);
    await expectCases(
      'tags',
      [
        ['10', tags(10), true],
        ['11', tags(11), false],
        ['1 character', ['a'], false],
        ['2 characters', ['ab'], true],
        ['24 characters', [A(24)], true],
        ['25 characters', [A(25)], false],
        ['upper case, trimmed', ['  Minecraft '], true],
        ['underscore', ['mine_craft'], false],
        ['space inside', ['mine craft'], false],
        ['accent', ['élan'], false],
      ],
      (value) => runPost({tags: value}),
    );
    const lowered = await runPost({tags: ['  Minecraft ', 'Survie']});
    expect(lowered.json.tags).toEqual(['minecraft', 'survie']);
  });

  it('timezone: an IANA zone or UTC+-HH:MM (hours 00 to 14, minutes 00 to 59), 64 characters at most', async () => {
    await expectCases(
      'timezone',
      [
        ['IANA', 'Europe/Paris', true],
        ['offset', 'UTC+02:00', true],
        ['offset max', 'UTC+14:00', true],
        ['offset negative', 'UTC-11:30', true],
        ['hours 15', 'UTC+15:00', false],
        ['minutes 60', 'UTC+02:60', false],
        ['no colon', 'UTC+0200', false],
        ['unknown zone', 'Mars/Olympus', false],
        ['too long', `Europe/${A(60)}`, false],
        ['null clears', null, true],
      ],
      (value) => runPost({timezone: value}),
    );
  });

  it('commitment: hours 1 to 168, openings 1 to 50, a compensation of the catalog, each field optional', async () => {
    await expectCases(
      'commitment',
      [
        ['empty', {}, true],
        ['hours 1', {hours_per_week: 1}, true],
        ['hours 168', {hours_per_week: 168}, true],
        ['hours 0', {hours_per_week: 0}, false],
        ['hours 169', {hours_per_week: 169}, false],
        ['openings 50', {openings: 50}, true],
        ['openings 0', {openings: 0}, false],
        ['openings 51', {openings: 51}, false],
        ['paid', {compensation: 'paid'}, true],
        ['unknown compensation', {compensation: 'tips'}, false],
        ['nulls', {hours_per_week: null, compensation: null, openings: null}, true],
      ],
      (value) => runPost({commitment: value}),
    );
  });

  it('URLs: https only, 500 characters at most, no credentials, no spaces, port 443 or none', async () => {
    const application = (url: string) => ({type: 'external_url', url});
    await expectCases(
      'application',
      [
        ['https', application('https://forms.example.com/modo'), true],
        ['port 443', application('https://forms.example.com:443/modo'), true],
        ['http', application('http://forms.example.com/modo'), false],
        ['credentials', application('https://user:pw@forms.example.com/'), false],
        ['port 8443', application('https://forms.example.com:8443/'), false],
        ['space', application('https://forms.example.com/a b'), false],
        ['500 characters', application(`https://example.com/${A(500 - 20)}`), true],
        ['501 characters', application(`https://example.com/${A(501 - 20)}`), false],
        ['no url', {type: 'external_url'}, false],
        ['a DM carries no url', {type: 'discord_dm', url: 'https://example.com'}, false],
        ['a DM', {type: 'discord_dm'}, true],
        ['null clears', null, true],
      ],
      (value) => runPost({application: value}),
    );
  });

  it('expires_at: with a time zone, in the future for a published post, 180 days at most', async () => {
    await expectCases(
      'expires_at',
      [
        ['null', null, true],
        ['in 179 days', day(179), true],
        ['in 181 days', day(181), false],
        ['no time zone', '2026-12-01T00:00:00', false],
        ['a date only', '2026-12-01', false],
        ['not a date', 'demain', false],
      ],
      (value) => runPost({expires_at: value}),
    );
  });

  it('refuses a published post whose date has passed with lineup_post_expired, and accepts it as a draft', async () => {
    const api = createTestApi('ines');
    const past = iso(new Date(NOW.getTime() - 3600_000));
    const published = await api.call('POST', '/lineup/posts', {body: {...POST, status: 'published', expires_at: past}});
    expect([published.status, published.json.code]).toEqual([422, 'lineup_post_expired']);
    expect((await api.call('POST', '/lineup/posts', {body: {...POST, expires_at: past}})).status).toBe(201);
  });
});

describe('profile limits (§4)', () => {
  it('server profile: description 2000, 5 links of label 1 to 40 and an https url, 10 tags, 10 languages, a catalog theme', async () => {
    const put = async (body: Record<string, unknown>) =>
      createTestApi('camille').call('PUT', `/lineup/guilds/${G.atelier}`, {body});
    const link = (label: string, url = 'https://example.com') => ({label, url});
    const guild = (field: string, cases: Case[]) => expectCases(field, cases, (value) => put({[field]: value}));
    await guild('description', [
      ['2000', A(2000), true],
      ['2001', A(2001), false],
      ['null clears', null, true],
    ]);
    await guild('links', [
      ['5', Array.from({length: 5}, (_, i) => link(`Lien ${i}`)), true],
      ['6', Array.from({length: 6}, (_, i) => link(`Lien ${i}`)), false],
      ['label 40', [link(A(40))], true],
      ['label 41', [link(A(41))], false],
      ['empty label', [link('')], false],
      ['http', [link('Site', 'http://example.com')], false],
      ['null', null, false],
      ['empty', [], true],
    ]);
    await guild('theme', [
      ['gaming', 'gaming', true],
      ['unknown', 'cooking', false],
      ['null clears', null, true],
    ]);
    await guild('tags', [
      ['10', Array.from({length: 10}, (_, i) => `tag-${i}`), true],
      ['11', Array.from({length: 11}, (_, i) => `tag-${i}`), false],
      ['null', null, false],
    ]);
    await guild('listed', [
      ['false', false, true],
      ['null', null, false],
      ['text', 'non', false],
    ]);
  });

  it('user profile: headline 120, bio 2000, 5 links, 10 languages, a valid timezone', async () => {
    const put = async (body: Record<string, unknown>) =>
      createTestApi('camille').call('PUT', '/lineup/me/profile', {body});
    const user = (field: string, cases: Case[]) => expectCases(field, cases, (value) => put({[field]: value}));
    await user('headline', [
      ['120', A(120), true],
      ['121', A(121), false],
      ['null', null, true],
    ]);
    await user('bio', [
      ['2000', A(2000), true],
      ['2001', A(2001), false],
      ['null', null, true],
    ]);
    await user('links', [
      ['5', Array.from({length: 5}, (_, i) => ({label: `L${i}`, url: 'https://example.com'})), true],
      ['6', Array.from({length: 6}, (_, i) => ({label: `L${i}`, url: 'https://example.com'})), false],
    ]);
    await user('languages', [
      ['10', catalogFixture.languages.slice(0, 10).map((entry) => entry.id), true],
      ['11', catalogFixture.languages.slice(0, 11).map((entry) => entry.id), false],
    ]);
    await user('timezone', [
      ['IANA', 'America/New_York', true],
      ['bad', 'Nowhere/City', false],
      ['null', null, true],
    ]);
    await user('open_to_work', [
      ['true', true, true],
      ['null', null, false],
    ]);
  });
});

describe('experience limits (§4)', () => {
  const create = (body: Record<string, unknown>) =>
    createTestApi('ines').call('POST', '/lineup/me/experiences', {
      body: {kind: 'service', name: 'Forum', position: 'moderator', start_date: '2024-01-01', ...body},
    });

  it('name 1 to 100, description 1000, position_other 1 to 40 if and only if `other`', async () => {
    await expectCases(
      'name',
      [
        ['1', 'F', true],
        ['100', A(100), true],
        ['101', A(101), false],
        ['empty', '', false],
      ],
      (value) => create({name: value}),
    );
    await expectCases(
      'description',
      [
        ['1000', A(1000), true],
        ['1001', A(1001), false],
        ['null', null, true],
      ],
      (value) => create({description: value}),
    );
    await expectCases(
      'position_other',
      [
        ['40', A(40), true],
        ['41', A(41), false],
        ['empty', '', false],
      ],
      (value) => create({position: 'other', position_other: value}),
    );
    await expectCases('position_other', [['without other', 'Capitaine', false]], (value) =>
      create({position_other: value}),
    );
    await expectCases(
      'position',
      [
        ['unknown', 'pilot', false],
        ['null', null, false],
      ],
      (value) => create({position: value}),
    );
  });

  it('dates: real calendar dates, not in the future, the end not before the start', async () => {
    const today = NOW.toISOString().slice(0, 10);
    await expectCases(
      'start_date',
      [
        ['today', today, true],
        ['tomorrow', new Date(NOW.getTime() + 86_400_000).toISOString().slice(0, 10), false],
        ['impossible day', '2026-02-30', false],
        ['wrong format', '01/01/2024', false],
        ['missing', undefined, false],
      ],
      (value) => create(value === undefined ? {start_date: undefined} : {start_date: value}),
    );
    await expectCases(
      'end_date',
      [
        ['null (current)', null, true],
        ['same day', '2024-01-01', true],
        ['before the start', '2023-12-31', false],
        ['future', new Date(NOW.getTime() + 86_400_000 * 3).toISOString().slice(0, 10), false],
      ],
      (value) => create({end_date: value}),
    );
  });

  it('refuses a `service` with an invitation, a `guild` without one, and a bad kind', async () => {
    expect((await create({invite: 'cubelands'})).json.detail[0].loc).toEqual(['body', 'invite']);
    expect((await create({kind: 'guild', name: undefined})).json.detail[0]).toMatchObject({
      type: 'missing',
      loc: ['body', 'invite'],
    });
    expect((await create({kind: 'team'})).json.detail[0].type).toBe('literal_error');
  });
});

describe('reports and moderation limits (§4, §6.7)', () => {
  const report = (body: Record<string, unknown>) =>
    createTestApi('camille').call('POST', '/lineup/reports', {
      body: {target_type: 'user', target_id: U.alex, reason: 'spam', ...body},
    });

  it('details 1000, reason and target_type from their lists', async () => {
    await expectCases(
      'details',
      [
        ['1000', A(1000), true],
        ['1001', A(1001), false],
      ],
      (value) => report({details: value}),
    );
    await expectCases(
      'reason',
      [
        ['spam', 'spam', true],
        ['scam', 'scam', true],
        ['inappropriate', 'inappropriate', true],
        ['impersonation', 'impersonation', true],
        ['other', 'other', true],
        ['hate', 'hate', false],
      ],
      (value) => report({reason: value}),
    );
    await expectCases('target_type', [['channel', 'channel', false]], (value) => report({target_type: value}));
  });

  it('staff notes and reasons: note 500 / 200, reason 1 to 500', async () => {
    const staff = createTestApi('noe');
    const note = (value: unknown) =>
      staff.call('POST', `/lineup/staff/experiences/e0000000-0000-4000-8000-000000000004/verify`, {
        body: {note: value},
      });
    await expectCases(
      'note',
      [
        ['500', A(500), true],
        ['501', A(501), false],
      ],
      note,
    );
    const reject = (value: unknown) =>
      staff.call('POST', `/lineup/staff/experiences/e0000000-0000-4000-8000-000000000004/reject`, {
        body: {reason: value},
      });
    await expectCases(
      'reason',
      [
        ['1', 'x', true],
        ['500', A(500), true],
        ['501', A(501), false],
        ['empty', '', false],
      ],
      reject,
    );
    const badge = (value: unknown) =>
      staff.call('PUT', `/lineup/staff/badges/user/${U.alex}/lineup_verified`, {body: {note: value}});
    await expectCases(
      'note',
      [
        ['200', A(200), true],
        ['201', A(201), false],
      ],
      badge,
    );
    const request = (value: unknown) =>
      createTestApi('camille').call(
        'POST',
        '/lineup/me/experiences/e0000000-0000-4000-8000-000000000004/request-review',
        {body: {note: value}},
      );
    await expectCases(
      'note',
      [
        ['500', A(500), true],
        ['501', A(501), false],
      ],
      request,
    );
  });
});

describe('quotas and the experience limit (§4, §8)', () => {
  it('5 published posts per server and 3 per person, computed on the published and unexpired ones', async () => {
    const api = createTestApi('ines');
    const publish = () => api.call('POST', '/lineup/posts', {body: {...POST, status: 'published'}});
    for (let i = 0; i < 3; i += 1) expect((await publish()).status).toBe(201);
    const refused = await publish();
    expect([refused.status, refused.json.limit, refused.json.scope]).toEqual([409, 3, 'user']);
    // A draft is not counted.
    expect((await api.call('POST', '/lineup/posts', {body: POST})).status).toBe(201);
  });

  it('50 experiences at most', async () => {
    const api = createTestApi('ines');
    for (let i = 0; i < 50; i += 1) {
      const response = await api.call('POST', '/lineup/me/experiences', {
        body: {kind: 'service', name: `Service ${i}`, position: 'moderator', start_date: '2024-01-01'},
      });
      expect(response.status, `experience ${i + 1}`).toBe(201);
    }
    const over = await api.call('POST', '/lineup/me/experiences', {
      body: {kind: 'service', name: 'Un de trop', position: 'moderator', start_date: '2024-01-01'},
    });
    expect([over.status, over.json.code]).toEqual([409, 'lineup_experience_limit']);
  });
});
