import {describe, expect, it} from 'vitest';

import {experienceId as x, G, postId, U} from '../seed/ids';
import {createTestApi} from '../testing';

const BASE = '/lineup/me/experiences';
const status = (json: {verification: {status: string}}) => json.verification.status;

describe('listing and creating', () => {
  it('lists the person’s experiences in their order, in the private view', async () => {
    const api = createTestApi('camille');
    const response = await api.call('GET', BASE);
    expect(response.status).toBe(200);
    const items = response.json.items as Array<{id: string; sort_index: number; verification: Record<string, unknown>}>;
    expect(items.map((item) => item.sort_index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(new Set(items.map((item) => status(item as never)))).toEqual(
      new Set(['verified', 'unverified', 'pending', 'rejected']),
    );
    const verified = items.find((item) => item.id === x(1));
    expect(verified?.verification).toMatchObject({
      method: 'discord_oauth',
      evidence: {permissions: ['ADMINISTRATOR'], owner: true, role_count: 6},
      rejection_reason: null,
    });
    expect(items.find((item) => item.id === x(7))?.verification.rejection_reason).toMatch(/redemandez/);
    expect(items.find((item) => item.id === x(6))?.verification).toMatchObject({
      status: 'pending',
      evidence: {review_note: expect.any(String)},
    });
    expect(items[0]).toMatchObject({guild: null, invite_url: 'https://discord.gg/atelier-phenix', is_current: true});
  });

  it('creates a server experience from an invitation: unverified, last, named after the server', async () => {
    const api = createTestApi('camille');
    const response = await api.call('POST', BASE, {
      body: {
        kind: 'guild',
        invite: 'https://discord.gg/cubelands',
        name: 'ignored',
        position: 'moderator',
        start_date: '2025-02-01',
      },
    });
    expect(response.status).toBe(201);
    expect(response.json).toMatchObject({
      kind: 'guild',
      guild_id: G.cubelands,
      name: 'Cubelands FR',
      invite_url: 'https://discord.gg/cubelands',
      sort_index: 9,
      end_date: null,
      is_current: true,
      verification: {status: 'unverified', method: null, verified_at: null, evidence: null, rejection_reason: null},
    });
  });

  it('creates a service experience', async () => {
    const api = createTestApi('camille');
    const response = await api.call('POST', BASE, {
      body: {
        kind: 'service',
        name: 'Serveur Minecraft de mon école',
        position: 'other',
        position_other: 'Parrain des nouveaux',
        start_date: '2024-01-10',
        end_date: '2024-06-30',
      },
    });
    expect(response.status).toBe(201);
    expect(response.json).toMatchObject({
      kind: 'service',
      guild_id: null,
      invite_url: null,
      is_current: false,
      position_other: 'Parrain des nouveaux',
    });
  });

  it('answers the invitation errors of §3', async () => {
    const api = createTestApi('camille');
    const create = (invite: string) =>
      api.call('POST', BASE, {body: {kind: 'guild', invite, position: 'moderator', start_date: '2025-02-01'}});
    expect((await create('zzz999')).json.code).toBe('invite_not_found');
    expect((await create('vieux-code')).json.code).toBe('invite_not_found');
    expect((await create('nocturne-temp')).json.code).toBe('invite_expiring');
    expect((await create('groupe-mp')).json.code).toBe('invite_invalid');
    expect((await create('http://discord.gg/cubelands')).json.code).toBe('invite_invalid');
    expect((await create('https://evil.example.com/cubelands')).json.code).toBe('invite_invalid');
    api.state.discordDown = true;
    const down = await create('cubelands');
    expect([down.status, down.headers.get('Retry-After')]).toEqual([503, '30']);
  });

  it('validates the body like the doc says', async () => {
    const api = createTestApi('camille');
    const detail = async (body: unknown) =>
      ((await api.call('POST', BASE, {body})).json.detail as Array<{loc: string[]; type: string}>).map((issue) =>
        issue.loc.join('.'),
      );
    expect(await detail({kind: 'service', position: 'moderator', start_date: '2025-01-01'})).toEqual(['body.name']);
    expect(await detail({kind: 'guild', position: 'moderator', start_date: '2025-01-01'})).toEqual(['body.invite']);
    expect(
      await detail({kind: 'service', name: 'x', invite: 'abc', position: 'moderator', start_date: '2025-01-01'}),
    ).toEqual(['body.invite']);
    expect(await detail({kind: 'service', name: 'x', position: 'other', start_date: '2025-01-01'})).toEqual([
      'body.position_other',
    ]);
    expect(
      await detail({kind: 'service', name: 'x', position: 'moderator', position_other: 'y', start_date: '2025-01-01'}),
    ).toEqual(['body.position_other']);
    expect(await detail({kind: 'service', name: 'x', position: 'moderator', start_date: '2027-01-01'})).toEqual([
      'body.start_date',
    ]);
    expect(
      await detail({
        kind: 'service',
        name: 'x',
        position: 'moderator',
        start_date: '2025-05-01',
        end_date: '2025-01-01',
      }),
    ).toEqual(['body.end_date']);
    expect(await detail({kind: 'service', name: 'x', position: 'wizard', start_date: '2025-01-01'})).toEqual([
      'body.position',
    ]);
    expect(await detail({kind: 'service', name: 'x', position: 'moderator', start_date: '2025-13-40'})).toEqual([
      'body.start_date',
    ]);
    expect(await detail({kind: 'service', name: '', position: 'moderator', start_date: '2025-01-01'})).toEqual([
      'body.name',
    ]);
  });

  it('stops at 50 experiences', async () => {
    const api = createTestApi('ines');
    const body = {kind: 'service', name: 'Service', position: 'moderator', start_date: '2025-01-01'};
    for (let i = 0; i < 50; i += 1) expect((await api.call('POST', BASE, {body})).status).toBe(201);
    const over = await api.call('POST', BASE, {body});
    expect([over.status, over.json.code]).toEqual([409, 'lineup_experience_limit']);
  });
});

describe('what resets a verification (§7)', () => {
  const patch = (api: ReturnType<typeof createTestApi>, id: string, body: unknown) =>
    api.call('PATCH', `${BASE}/${id}`, {body});

  it('never resets for the description, nor for the same value sent again', async () => {
    const api = createTestApi('camille');
    const first = await patch(api, x(1), {
      description: 'Autre description.',
      start_date: '2022-06-03',
      position: 'admin',
    });
    expect(first.json.verification).toMatchObject({status: 'verified', method: 'discord_oauth'});
    expect(first.json.verification.evidence).not.toBeNull();
    expect(first.json.description).toBe('Autre description.');
  });

  it('resets everything when position, position_other, a start date or an end date really changes', async () => {
    for (const body of [
      {position: 'moderator'},
      {start_date: '2022-07-01'},
      {end_date: '2024-01-01', position: 'moderator'},
    ]) {
      const api = createTestApi('camille');
      const response = await patch(api, x(1), body);
      expect(response.json.verification, JSON.stringify(body)).toEqual({
        status: 'unverified',
        method: null,
        verified_at: null,
        evidence: null,
        rejection_reason: null,
      });
    }
  });

  it('keeps `verified` when an end_date is set on a verified, current experience and nothing else sensitive changes', async () => {
    const api = createTestApi('camille');
    const response = await patch(api, x(2), {end_date: '2025-06-30', description: 'Terminé, merci à l’équipe.'});
    expect(response.json).toMatchObject({is_current: false, end_date: '2025-06-30'});
    expect(response.json.verification).toMatchObject({status: 'verified', method: 'discord_oauth'});
    expect(response.json.verification.evidence).toMatchObject({permissions: ['ADMINISTRATOR']});
    // ...but not to change or remove an end that is already there.
    expect(status((await patch(api, x(2), {end_date: '2025-05-31'})).json)).toBe('unverified');
  });

  it('does not extend the exception to anything else sensitive in the same PATCH, nor to pending/rejected', async () => {
    const api = createTestApi('camille');
    expect(status((await patch(api, x(2), {end_date: '2025-06-30', start_date: '2023-03-01'})).json)).toBe(
      'unverified',
    );
    expect(status((await patch(api, x(1), {end_date: '2025-06-30', position: 'manager'})).json)).toBe('unverified');
    // x(6): pending, already ended: changing the end resets it. x(7): rejected.
    expect(status((await patch(api, x(6), {end_date: '2023-05-01'})).json)).toBe('unverified');
    expect(status((await patch(api, x(7), {name: 'Forum Les Cartographes FR'})).json)).toBe('unverified');
    const pendingCurrent = createTestApi('camille');
    const row = pendingCurrent.server.db.experiences[x(9)];
    if (row) row.status = 'pending';
    expect(status((await patch(pendingCurrent, x(9), {end_date: '2025-09-01'})).json)).toBe('unverified');
  });

  it('resets when the invitation leads to ANOTHER server, not when it is another code of the same one', async () => {
    const api = createTestApi('camille');
    const same = await patch(api, x(1), {invite: 'atelier'});
    expect(same.json).toMatchObject({invite_url: 'https://discord.gg/atelier', guild_id: G.atelier});
    expect(status(same.json)).toBe('verified');
    const other = await patch(api, x(1), {invite: 'https://discord.com/invite/cubelands'});
    expect(other.json).toMatchObject({guild_id: G.cubelands, name: 'Cubelands FR'});
    expect(status(other.json)).toBe('unverified');
  });

  it('empties position_other by itself when the position becomes a catalog one', async () => {
    const api = createTestApi('camille');
    const response = await patch(api, x(8), {position: 'moderator'});
    expect(response.json).toMatchObject({position: 'moderator', position_other: null});
  });

  it('answers lineup_experience_invalid for an invalid merged state', async () => {
    const api = createTestApi('camille');
    const invalid = async (id: string, body: unknown) => {
      const response = await patch(api, id, body);
      return [response.status, response.json.code];
    };
    expect(await invalid(x(6), {invite: 'cubelands'})).toEqual([422, 'lineup_experience_invalid']);
    expect(await invalid(x(1), {position: 'other'})).toEqual([422, 'lineup_experience_invalid']);
    expect(await invalid(x(1), {position_other: 'Chef'})).toEqual([422, 'lineup_experience_invalid']);
    expect(await invalid(x(7), {end_date: '2018-01-01'})).toEqual([422, 'lineup_experience_invalid']);
    expect(await invalid(x(1), {start_date: '2099-01-01'})).toEqual([422, 'lineup_experience_invalid']);
  });

  it('refuses kind, and null on position or start_date; accepts end_date null', async () => {
    const api = createTestApi('camille');
    expect((await patch(api, x(1), {kind: 'service'})).json.detail[0].type).toBe('extra_forbidden');
    expect((await patch(api, x(1), {position: null})).json.detail[0].type).toBe('string_type');
    expect((await patch(api, x(1), {start_date: null})).json.detail[0].type).toBe('date_type');
    const ended = await patch(api, x(8), {end_date: null});
    expect(ended.json).toMatchObject({end_date: null, is_current: true});
    expect(status(ended.json)).toBe('unverified');
  });

  it('answers 404 for someone else’s experience and 422 for a malformed id', async () => {
    const api = createTestApi('camille');
    expect((await patch(api, x(10), {description: 'x'})).json.code).toBe('lineup_experience_not_found');
    expect((await patch(api, 'nope', {description: 'x'})).json).toMatchObject({
      detail: [{type: 'uuid_parsing', loc: ['path', 'exp_id']}],
    });
  });
});

describe('order and deletion', () => {
  it('reorders with the exact list of ids', async () => {
    const api = createTestApi('camille');
    const ids = (await api.call('GET', BASE)).json.items.map((item: {id: string}) => item.id) as string[];
    const reversed = [...ids].reverse();
    const response = await api.call('PUT', `${BASE}/order`, {body: {ids: reversed}});
    expect(response.status).toBe(200);
    expect(response.json.items.map((item: {id: string}) => item.id)).toEqual(reversed);
    for (const bad of [ids.slice(1), [...ids, x(10)], [...ids.slice(1), ids[1]], []]) {
      const failed = await api.call('PUT', `${BASE}/order`, {body: {ids: bad}});
      expect([failed.status, failed.json.code]).toEqual([422, 'lineup_experience_order_invalid']);
    }
  });

  it('deletes (204) and clears the featured experience of a post, keeping the post', async () => {
    const api = createTestApi('camille');
    expect(api.server.db.posts[postId(31)]?.featured_experience_id).toBe(x(2));
    expect((await api.call('DELETE', `${BASE}/${x(2)}`)).status).toBe(204);
    expect(api.server.db.posts[postId(31)]).toMatchObject({featured_experience_id: null, status: 'published'});
    expect((await api.call('DELETE', `${BASE}/${x(2)}`)).json.code).toBe('lineup_experience_not_found');
  });
});

describe('automatic verification (§7)', () => {
  const verify = (api: ReturnType<typeof createTestApi>, id: string) => api.call('POST', `${BASE}/${id}/verify`);

  it('verifies a member with a staff permission, keeping a proof without the roles', async () => {
    const api = createTestApi('camille');
    const response = await verify(api, x(3));
    expect(response.status).toBe(200);
    expect(response.json.verification).toMatchObject({
      status: 'verified',
      method: 'discord_oauth',
      rejection_reason: null,
      evidence: {permissions: ['MANAGE_MESSAGES', 'MODERATE_MEMBERS'], owner: false, role_count: 4},
    });
    expect(response.json.verification.verified_at).toBe(response.json.verification.evidence.checked_at);
    // An owner without a listed permission still qualifies.
    expect((await verify(api, x(9))).json.verification.evidence).toMatchObject({owner: true});
  });

  it('answers lineup_verification_failed with the reason and can_request_review', async () => {
    const api = createTestApi('camille');
    const noPermission = await verify(api, x(4));
    expect(noPermission.status).toBe(422);
    expect(noPermission.json).toMatchObject({
      code: 'lineup_verification_failed',
      reason: 'no_staff_permission',
      can_request_review: true,
    });
    const notMember = await verify(api, x(5));
    expect(notMember.json).toMatchObject({reason: 'not_member', can_request_review: true});
  });

  it('refuses a service and an ended experience (not applicable), before anything else', async () => {
    const api = createTestApi('camille');
    api.as('camille', {scopes: false});
    const service = await verify(api, x(6));
    expect(service.json).toMatchObject({code: 'lineup_verification_not_applicable', reason: 'not_guild'});
    const ended = await verify(api, x(8));
    expect(ended.json).toMatchObject({code: 'lineup_verification_not_applicable', reason: 'ended'});
    expect(ended.status).toBe(422);
  });

  it('checks in the documented order when several conditions fail together', async () => {
    const api = createTestApi('camille');
    api.as('camille', {scopes: false});
    api.state.discordDown = true;
    // Verified, then ended: 422 ended (not 200), whatever the scopes and Discord say.
    api.server.db.experiences[x(1)]!.end_date = '2026-01-01';
    const ended = await verify(api, x(1));
    expect(ended.status).toBe(422);
    expect(ended.json).toMatchObject({code: 'lineup_verification_not_applicable', reason: 'ended'});
    // A service wins over ended.
    api.server.db.experiences[x(6)]!.end_date = '2026-01-01';
    expect((await verify(api, x(6))).json.reason).toBe('not_guild');
    // Unknown id before anything else; session before the unknown id.
    expect((await verify(api, '00000000-0000-4000-8000-00000000ffff')).status).toBe(404);
    // No scope beats the rate limit and Discord's silence.
    expect((await verify(api, x(5))).json.code).toBe('lineup_reauth_required');
    // Then the rate limit beats Discord's silence.
    api.as('camille');
    for (let i = 0; i < 5; i += 1) expect((await verify(api, x(5))).status).toBe(503);
    expect((await verify(api, x(5))).status).toBe(429);
    api.as(null);
    expect((await verify(api, x(5))).status).toBe(401);
  });

  it('answers lineup_reauth_required with login_url for a session born from the dashboard', async () => {
    const api = createTestApi();
    api.as('camille', {scopes: false});
    const response = await verify(api, x(3));
    expect(response.status).toBe(403);
    expect(response.json).toMatchObject({
      code: 'lineup_reauth_required',
      login_url: '/lineup/auth/login',
      error: {login_url: '/lineup/auth/login'},
    });
  });

  it('returns an already verified experience as it is', async () => {
    const api = createTestApi('camille');
    api.state.discordDown = true;
    const response = await verify(api, x(1));
    expect(response.status).toBe(200);
    expect(status(response.json)).toBe('verified');
  });

  it('allows 5 attempts per 10 minutes, then 429 with the delay in the body and Retry-After', async () => {
    const api = createTestApi('camille');
    for (let i = 0; i < 5; i += 1) expect((await verify(api, x(5))).status).toBe(422);
    const limited = await verify(api, x(5));
    expect(limited.status).toBe(429);
    expect(limited.json).toMatchObject({code: 'lineup_rate_limited', retry_after: 600});
    expect(limited.headers.get('Retry-After')).toBe('600');
    api.state.now = new Date(api.state.now.getTime() + 601_000);
    expect((await verify(api, x(5))).status).toBe(422);
  });

  it('answers 503, never a false failure, when Discord is silent', async () => {
    const api = createTestApi('camille');
    api.state.discordDown = true;
    const response = await verify(api, x(3));
    expect(response.status).toBe(503);
    expect(response.headers.get('Retry-After')).toBe('30');
  });

  it('obeys the dev panel’s forced outcome', async () => {
    const api = createTestApi('camille');
    api.state.verifyOutcome = 'not_member';
    expect((await verify(api, x(3))).json.reason).toBe('not_member');
    api.state.verifyOutcome = 'no_staff_permission';
    expect((await verify(api, x(3))).json.reason).toBe('no_staff_permission');
    api.state.verifyOutcome = 'success';
    expect(status((await verify(api, x(5))).json)).toBe('verified');
  });
});

describe('manual review', () => {
  it('moves unverified or rejected to pending and keeps the note in the proof', async () => {
    const api = createTestApi('camille');
    const response = await api.call('POST', `${BASE}/${x(3)}/request-review`, {
      body: {note: 'Je suis modératrice depuis mars 2024.'},
    });
    expect(response.json.verification).toMatchObject({
      status: 'pending',
      evidence: {review_note: 'Je suis modératrice depuis mars 2024.', requested_at: expect.any(String)},
    });
    const rejected = await api.call('POST', `${BASE}/${x(7)}/request-review`);
    expect(rejected.json.verification).toMatchObject({status: 'pending', rejection_reason: null});
  });

  it('accepts a missing body or {}, refuses a long note and unknown fields', async () => {
    const api = createTestApi('camille');
    expect((await api.call('POST', `${BASE}/${x(4)}/request-review`, {body: {}})).status).toBe(200);
    expect(
      (await api.call('POST', `${BASE}/${x(5)}/request-review`, {body: {note: 'x'.repeat(501)}})).json.detail[0].type,
    ).toBe('string_too_long');
    expect((await api.call('POST', `${BASE}/${x(5)}/request-review`, {body: {notes: 'x'}})).json.detail[0].type).toBe(
      'extra_forbidden',
    );
  });

  it('refuses a review on a verified or pending experience', async () => {
    const api = createTestApi('camille');
    expect((await api.call('POST', `${BASE}/${x(1)}/request-review`)).json.code).toBe(
      'lineup_experience_already_verified',
    );
    expect((await api.call('POST', `${BASE}/${x(6)}/request-review`)).json.code).toBe('lineup_review_already_pending');
    expect((await api.call('POST', `${BASE}/${x(10)}/request-review`)).json.code).toBe('lineup_experience_not_found');
  });

  it('gets verified or rejected by the staff, who see the queue oldest first', async () => {
    const api = createTestApi('noe');
    const queue = await api.call('GET', '/lineup/staff/experiences');
    expect(queue.status).toBe(200);
    const items = queue.json.items as Array<{user_id: string; updated_at: string; verification: {status: string}}>;
    expect(items.every((item) => item.verification.status === 'pending')).toBe(true);
    expect(items.every((item) => typeof item.user_id === 'string')).toBe(true);
    const times = items.map((item) => Date.parse(item.updated_at));
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect((await api.call('GET', '/lineup/staff/experiences', {query: {status: 'done'}})).json.detail[0].type).toBe(
      'literal_error',
    );

    const verified = await api.call('POST', `/lineup/staff/experiences/${x(6)}/verify`, {
      body: {note: 'Compte confirmé.'},
    });
    expect(verified.json).toMatchObject({user_id: U.camille});
    expect(verified.json.verification).toMatchObject({
      status: 'verified',
      method: 'moddy_staff',
      evidence: {
        review_note: expect.any(String),
        staff_note: 'Compte confirmé.',
        verified_at_by_staff: expect.any(String),
      },
    });
    const rejected = await api.call('POST', `/lineup/staff/experiences/${x(23)}/reject`, {
      body: {reason: 'Lien introuvable.'},
    });
    expect(rejected.json.verification).toMatchObject({status: 'rejected', rejection_reason: 'Lien introuvable.'});
    expect((await api.call('POST', `/lineup/staff/experiences/${x(23)}/reject`, {body: {}})).json.detail[0].type).toBe(
      'missing',
    );
    expect(
      (await api.call('POST', `/lineup/staff/experiences/${x(1)}/reject`, {body: {reason: 'Test'}})).json.verification
        .status,
    ).toBe('rejected');
    expect(
      (await api.call('POST', '/lineup/staff/experiences/e0000000-0000-4000-8000-0000000000ff/verify')).json.code,
    ).toBe('lineup_experience_not_found');
  });
});
