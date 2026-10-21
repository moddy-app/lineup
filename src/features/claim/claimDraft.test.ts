import {describe, expect, it} from 'vitest';

import {parseClaimDraft} from './claimDraft';

describe('parseClaimDraft', () => {
  it('keeps the invitation and the targeted server', () => {
    expect(parseClaimDraft({invite: 'abc', guildId: '123'})).toEqual({invite: 'abc', guildId: '123'});
  });

  it('falls back to the free field without a server id', () => {
    expect(parseClaimDraft({invite: 'abc'})).toEqual({invite: 'abc', guildId: null});
    expect(parseClaimDraft({invite: 'abc', guildId: 12})).toEqual({invite: 'abc', guildId: null});
  });

  it('keeps a targeted server alone: Moddy creates the invitation, nothing was typed', () => {
    expect(parseClaimDraft({invite: '', guildId: '123'})).toEqual({invite: '', guildId: '123'});
    expect(parseClaimDraft({guildId: '123'})).toEqual({invite: '', guildId: '123'});
  });

  it('ignores an empty or malformed draft', () => {
    expect(parseClaimDraft(null)).toBeNull();
    expect(parseClaimDraft('abc')).toBeNull();
    expect(parseClaimDraft({invite: '  '})).toBeNull();
    expect(parseClaimDraft({invite: 4})).toBeNull();
    expect(parseClaimDraft({invite: '', guildId: 7})).toBeNull();
  });
});
