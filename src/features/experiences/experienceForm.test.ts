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

function experience(
  overrides: Partial<PrivateExperience> = {},
  status: PrivateExperience['verification']['status'] = 'verified',
): PrivateExperience {
  return {
    id: 'e1',
    kind: 'guild',
    guild_id: '1',
    name: 'Cubelands',
    invite_url: 'https://discord.gg/x',
    image_url: null,
    member_count: null,
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
    expect(
      validateExperience(
        {...form, start_date: '2025-01-01', end_date: '2024-01-01', position_other: 'x'},
        {editing: false, today},
      ).end_date?.key,
    ).toBe('endBeforeStart');
  });

  it('accepts an empty image or an https one of 500 characters at most, for a service', () => {
    const form = {
      ...emptyForm(),
      kind: 'service' as const,
      name: 'Studio',
      position: 'moderator',
      start_date: '2024-01-01',
    };
    const image = (image_url: string) =>
      validateExperience({...form, image_url}, {editing: false, today}).image_url?.key;
    expect(image('')).toBeUndefined();
    expect(image('  ')).toBeUndefined();
    expect(image('https://cdn.example.com/logo.png')).toBeUndefined();
    expect(image('http://cdn.example.com/logo.png')).toBe('imageNotHttps');
    expect(image('cdn.example.com/logo.png')).toBe('imageNotHttps');
    expect(image('https://cdn.example.com/a b.png')).toBe('imageNotHttps');
    expect(image(`https://cdn.example.com/${'a'.repeat(500)}`)).toBe('imageTooLong');
    // A server experience has no image field to check.
    expect(
      validateExperience({...form, kind: 'guild', invite: 'abc', image_url: 'nope'}, {editing: false, today}).image_url,
    ).toBeUndefined();
  });

  it('todayIso is a local calendar day', () => {
    expect(todayIso(new Date(2026, 9, 5))).toBe('2026-10-05');
  });
});

describe('bodies', () => {
  it('builds a creation body per kind', () => {
    const form = {...emptyForm(), invite: ' abc ', position: 'moderator', start_date: '2024-01-01'};
    expect(createBody(form)).toEqual({
      kind: 'guild',
      invite: 'abc',
      position: 'moderator',
      description: null,
      start_date: '2024-01-01',
      end_date: null,
    });
    expect(createBody({...form, kind: 'service', name: ' Studio '})).toMatchObject({kind: 'service', name: 'Studio'});
  });

  it('sends the image of a service, or null when the field is empty', () => {
    const form = {
      ...emptyForm(),
      kind: 'service' as const,
      name: 'Studio',
      position: 'moderator',
      start_date: '2024-01-01',
    };
    expect(createBody({...form, image_url: ' https://cdn.example.com/a.png '})).toMatchObject({
      kind: 'service',
      image_url: 'https://cdn.example.com/a.png',
    });
    expect(createBody(form)).toMatchObject({kind: 'service', image_url: null});
    expect(
      createBody({...form, kind: 'guild', invite: 'abc', image_url: 'https://x.example.com/a.png'}),
    ).not.toHaveProperty('image_url');
  });

  it('edits a service image: sent when changed, null when emptied, never for a server', () => {
    const service = experience({
      kind: 'service',
      guild_id: null,
      invite_url: null,
      image_url: 'https://cdn.example.com/a.png',
    });
    const form = formFromExperience(service);
    expect(form.image_url).toBe('https://cdn.example.com/a.png');
    expect(updateBody(service, form)).toEqual({});
    expect(updateBody(service, {...form, image_url: 'https://cdn.example.com/b.png'})).toEqual({
      image_url: 'https://cdn.example.com/b.png',
    });
    expect(updateBody(service, {...form, image_url: ' '})).toEqual({image_url: null});
    expect(
      updateBody(experience(), {...formFromExperience(experience()), image_url: 'https://x.example.com/a.png'}),
    ).toEqual({});
    // The image never resets a verification.
    expect(verificationEffect(service, {image_url: null})).toBe('none');
  });

  it('sends only the changes of an edition', () => {
    const exp = experience();
    expect(updateBody(exp, formFromExperience(exp))).toEqual({});
    const form = {...formFromExperience(exp), current: false, end_date: '2025-01-01', description: 'Autre'};
    expect(updateBody(exp, form)).toEqual({end_date: '2025-01-01', description: 'Autre'});
    expect(
      updateBody(experience({end_date: '2025-01-01', is_current: false}), {...formFromExperience(exp), current: true}),
    ).toEqual({end_date: null});
  });
});

describe('verificationEffect', () => {
  it('keeps the verification when only an end date is added to a current verified experience', () => {
    expect(verificationEffect(experience(), {end_date: '2025-01-01'})).toBe('keeps');
    expect(verificationEffect(experience(), {end_date: '2025-01-01', position: 'admin'})).toBe('resets');
    expect(verificationEffect(experience(), {end_date: null})).toBe('none');
    expect(verificationEffect(experience({end_date: '2025-01-01', is_current: false}), {end_date: '2025-02-01'})).toBe(
      'resets',
    );
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
    expect(verificationOffer(experience({end_date: '2025-01-01', is_current: false}, 'unverified'))).toMatchObject({
      auto: false,
      review: true,
    });
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
