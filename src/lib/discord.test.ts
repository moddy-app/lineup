import {describe, expect, it} from 'vitest';

import {defaultAvatarUrl, snowflakeDate} from './discord';

describe('snowflakeDate', () => {
  it('decodes the documented example (Discord docs: 175928847299117063)', () => {
    expect(snowflakeDate('175928847299117063').toISOString()).toBe('2016-04-30T11:18:25.796Z');
  });

  it('starts at the Discord epoch', () => {
    expect(snowflakeDate('0').toISOString()).toBe('2015-01-01T00:00:00.000Z');
  });

  it('keeps full precision on 19-digit ids', () => {
    expect(snowflakeDate('345678901234567890').getUTCFullYear()).toBe(2017);
  });
});

describe('defaultAvatarUrl', () => {
  it('picks the avatar from (id >> 22) % 6', () => {
    // 175928847299117063 >> 22 = 41944705796, % 6 = 2
    expect(defaultAvatarUrl('175928847299117063')).toBe('https://cdn.discordapp.com/embed/avatars/2.png');
    expect(defaultAvatarUrl('0')).toBe('https://cdn.discordapp.com/embed/avatars/0.png');
  });

  it('always returns one of the six avatars', () => {
    for (const id of ['345678901234567890', '1', '4194304', '8388608', '999999999999999999']) {
      expect(defaultAvatarUrl(id)).toMatch(/\/embed\/avatars\/[0-5]\.png$/);
    }
  });
});
