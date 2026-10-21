import {describe, expect, it} from 'vitest';

import type {Badge} from '@/api/types';
import {i18n, initI18n} from '@/i18n';

import {verificationLabel, verificationOf} from './verification';

const badge = (id: string): Badge => ({id, label: {fr: id, en: id}, source: 'manual'});

describe('verificationOf', () => {
  it('returns null without badges, or without a verification badge', () => {
    expect(verificationOf(undefined, 'user')).toBeNull();
    expect(verificationOf(null, 'guild')).toBeNull();
    expect(verificationOf([], 'user')).toBeNull();
    expect(verificationOf([badge('moddy_premium'), badge('discord_verified')], 'guild')).toBeNull();
  });

  it('picks lineup_verified for both kinds of entity', () => {
    expect(verificationOf([badge('lineup_verified')], 'user')).toBe('lineup_verified');
    expect(verificationOf([badge('lineup_verified')], 'guild')).toBe('lineup_verified');
  });

  it('puts the Moddy team first for a person and the official server first for a server', () => {
    const all = [badge('lineup_verified'), badge('moddy_server'), badge('moddy_staff')];
    expect(verificationOf(all, 'user')).toBe('moddy_staff');
    expect(verificationOf(all, 'guild')).toBe('moddy_server');
  });

  it('ignores a verification that cannot apply to the entity', () => {
    expect(verificationOf([badge('moddy_server')], 'user')).toBeNull();
    expect(verificationOf([badge('moddy_staff')], 'guild')).toBeNull();
  });
});

describe('verificationLabel', () => {
  initI18n();
  it('names the kind in the current language, and the entity for lineup_verified', async () => {
    await i18n.changeLanguage('en');
    const t = i18n.getFixedT('en', 'components');
    expect(verificationLabel('moddy_staff', 'user', t)).toBe('Moddy team');
    expect(verificationLabel('moddy_server', 'guild', t)).toBe('Official Moddy server');
    expect(verificationLabel('lineup_verified', 'guild', t)).toBe('Verified server');
    expect(verificationLabel('lineup_verified', 'user', t)).toBe('Verified account');
  });
});
