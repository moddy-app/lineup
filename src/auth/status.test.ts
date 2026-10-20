import {describe, expect, it} from 'vitest';

import {ApiError} from '@/api/client';
import {makeMe} from '@/api/fixtures';
import type {SanctionInfo} from '@/api/types';

import {deriveSession} from './status';

const sanction: SanctionInfo = {
  code: 'user_suspended',
  level: 'ban',
  subject_type: 'discord_user',
  subject_id: '1',
  references: ['A7F2K9'],
  expires_at: null,
  message: 'm',
  violations_url: 'https://moddy.app/violations',
};
const network = new ApiError({status: 0, kind: 'network', code: 'network_error'});

describe('deriveSession', () => {
  it('is loading until the first answer', () => {
    expect(deriveSession({data: undefined, error: null, isPending: true})).toEqual({status: 'loading'});
  });

  it('is authenticated with the person', () => {
    const me = makeMe();
    expect(deriveSession({data: {status: 'authenticated', me}, error: null, isPending: false})).toEqual({
      status: 'authenticated',
      me,
    });
  });

  it('is anonymous on a 401', () => {
    expect(deriveSession({data: {status: 'anonymous'}, error: null, isPending: false})).toEqual({status: 'anonymous'});
  });

  it('is suspended on a user_suspended, keeping the sanction for the screen', () => {
    expect(deriveSession({data: {status: 'suspended', sanction}, error: null, isPending: false})).toEqual({
      status: 'suspended',
      sanction,
    });
  });

  it('treats any other failure as anonymous, and exposes it', () => {
    expect(deriveSession({data: undefined, error: network, isPending: false})).toEqual({
      status: 'anonymous',
      error: network,
    });
  });

  it('is still loading while a failing request is retried (pending, no error yet)', () => {
    expect(deriveSession({data: undefined, error: null, isPending: true}).status).toBe('loading');
  });

  it('keeps the last known session when a background refetch fails', () => {
    const me = makeMe();
    expect(deriveSession({data: {status: 'authenticated', me}, error: network, isPending: false}).status).toBe(
      'authenticated',
    );
  });
});
