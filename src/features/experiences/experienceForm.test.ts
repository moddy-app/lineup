import {describe, expect, it} from 'vitest';

import type {PrivateExperience} from '@/api/types';

import {
  createBody,
  emptyForm,
  formFromExperience,
  move,
  todayIso,
  updateBody,
  validateExperience,
  verificationEffect,
  verificationOffer,
} from './experienceForm';

function experience(overrides: Partial<PrivateExperience> = {}, status: PrivateExperience['verification']['status'] = 'verified'): PrivateExperience {
  return {
    id: 'e1',
    kind: 'guild',
    guild_id: '1',
    name: 'Cubelands',
    invite_url: 'https://discord.gg/x',
    guild: null,
    position: 'moderator',
    position_other: null,
    description: 'Texte',
    start_date: '2024-03-01',
    end_date: null,
    is_current: true,
    sort_index: 0,
    created_at: '2024-03-01T00:00:00+00:00',
    updated_at: '2024-03-01T00:00:00+00:00',
    verification: {status, method: 'discord_oauth', verified_at: null, evidence: null, rejection_reason: null},
    ...overrides,
  };
}

describe('validateExperience', () => {
  const today = '2026-10-20';
  it('needs an invitation to create a server experience, not to edit one', () => {
    const form = {...emptyForm(), position: 'moderator', start_date: '2024-01-01'};
    expect(validateExperience(form, {editing: false, today}).invite?.key).toBe('inviteRequired');
    expect(validateExperience(form, {editing: true, today}).invite).toBeUndefined();
  });

  it('checks dates and the other position', () => {
    const form = {
      ...emptyForm(),
      kind: 'service' as const,
      name: 'Studio',
      position: 'other',
      start_date: '2026-10-21',
      current: false,
      end_date: '2026-10-22',
    };
    const problems = validateExperience(form, {editing: false, today});
    expect(problems.position_other?.key).toBe('positionOtherRequired');
    expect(problems.start_date?.key).toBe('startFuture');
    expect(problems.end_date?.key).toBe('endFuture');
    expect(validateExperience({...form, start_date: '2025-01-01', end_date: '2024-01-01', position_other: 'x'}, {editing: false, today}).end_date?.key).toBe('endBeforeStart');
  });

  it('todayIso is a local calendar day', () => {
    expect(todayIso(new Date(2026, 9, 5))).toBe('2026-10-05');
  });
});

describe('bodies', () => {
  it('builds a creation body per kind', () => {
    const form = {...emptyForm(), invite: ' abc ', position: 'moderator', start_date: '2024-01-01'};
    expect(createBody(form)).toEqual({kind: 'guild', invite: 'abc', position: 'moderator', description: null, start_date: '2024-01-01', end_date: null});
    expect(createBody({...form, kind: 'service', name: ' Studio '})).toMatchObject({kind: 'service', name: 'Studio'});
  });

  it('sends only the changes of an edition', () => {
    const exp = experience();
    expect(updateBody(exp, formFromExperience(exp))).toEqual({});
    const form = {...formFromExperience(exp), current: false, end_date: '2025-01-01', description: 'Autre'};
    expect(updateBody(exp, form)).toEqual({end_date: '2025-01-01', description: 'Autre'});
    expect(updateBody(experience({end_date: '2025-01-01', is_current: false}), {...formFromExperience(exp), current: true})).toEqual({end_date: null});
  });
});

describe('verificationEffect', () => {
  it('keeps the verification when only an end date is added to a current verified experience', () => {
    expect(verificationEffect(experience(), {end_date: '2025-01-01'})).toBe('keeps');
    expect(verificationEffect(experience(), {end_date: '2025-01-01', position: 'admin'})).toBe('resets');
    expect(verificationEffect(experience(), {end_date: null})).toBe('none');
    expect(verificationEffect(experience({end_date: '2025-01-01', is_current: false}), {end_date: '2025-02-01'})).toBe('resets');
    expect(verificationEffect(experience(), {description: 'x'})).toBe('none');
    expect(verificationEffect(experience(), {invite: 'abc'})).toBe('resets');
  });

  it('does not apply the exception to pending or rejected, and ignores unverified', () => {
    expect(verificationEffect(experience({}, 'pending'), {end_date: '2025-01-01'})).toBe('resets');
    expect(verificationEffect(experience({}, 'rejected'), {position: 'admin'})).toBe('resets');
    expect(verificationEffect(experience({}, 'unverified'), {position: 'admin'})).toBe('none');
  });
});

describe('verificationOffer', () => {
  it('offers the automatic check first for a current server experience', () => {
    expect(verificationOffer(experience({}, 'unverified'))).toMatchObject({auto: true, review: true});
    expect(verificationOffer(experience({kind: 'service'}, 'rejected'))).toMatchObject({auto: false, review: true});
    expect(verificationOffer(experience({end_date: '2025-01-01', is_current: false}, 'unverified'))).toMatchObject({auto: false, review: true});
    expect(verificationOffer(experience({}, 'pending'))).toMatchObject({auto: false, review: false, pending: true});
    expect(verificationOffer(experience({}, 'verified'))).toMatchObject({auto: false, review: false, verified: true});
  });
});

describe('move', () => {
  it('moves one item', () => {
    expect(move(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
    expect(move(['a', 'b'], 1, 5)).toEqual(['a', 'b']);
  });
});
