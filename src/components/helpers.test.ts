import {afterEach, describe, expect, it} from 'vitest';

import {catalogFixture} from '@/api/catalog.fixture';

import {badgeIcon, FALLBACK_BADGE_ICON, hasBadgeIcon} from './badgeIcons';
import {EXPIRY_SOON_DAYS, expiryInfo, expiryIsNear} from './expiry';
import {guildTone} from './guildTone';
import {linkHost, safeLinks} from './links';
import {positionIcon, positionItems} from './positions';
import {postStatusView} from './postStatus';
import {plainExcerpt} from './text';
import {localTime, utcOffsetMinutes} from './timezone';

afterEach(() => {
  document.documentElement.lang = 'en';
});

describe('badgeIcon', () => {
  it('maps the badges the brief names', () => {
    expect(badgeIcon('discord_verified')).toBe('verified');
    expect(badgeIcon('discord_partner')).toBe('handshake');
    expect(badgeIcon('moddy_installed')).toBe('smart_toy');
    expect(badgeIcon('moddy_premium')).toBe('workspace_premium');
    expect(badgeIcon('nsfw')).toBe('explicit');
    expect(badgeIcon('moddy_staff')).toBe('shield_person');
    expect(badgeIcon('lineup_verified')).toBe('verified_user');
    expect(badgeIcon('moddy_partner')).toBe('handshake');
    expect(badgeIcon('moddy_server')).toBe('home');
    expect(badgeIcon('discord_staff')).toBe('badge');
    expect(badgeIcon('discord_certified_moderator')).toBe('gavel');
    expect(badgeIcon('discord_hypesquad_events')).toBe('celebration');
    expect(badgeIcon('discord_bug_hunter_level_1')).toBe('bug_report');
  });

  it('has an icon for every badge of the catalog', () => {
    for (const {id} of catalogFixture.badges) expect(hasBadgeIcon(id), id).toBe(true);
  });

  it('falls back to a generic icon for a badge it does not know', () => {
    expect(badgeIcon('brand_new_badge')).toBe(FALLBACK_BADGE_ICON);
    expect(FALLBACK_BADGE_ICON).toBe('workspace_premium');
    expect(hasBadgeIcon('brand_new_badge')).toBe(false);
  });
});

describe('positions', () => {
  it('has an icon for every position of the catalog', () => {
    for (const {id} of catalogFixture.positions) expect(positionIcon(id), id).not.toBe('');
    expect(positionIcon('moderator')).toBe('shield_person');
    expect(positionIcon('wizard')).toBe('work');
  });

  it('shows the author words in place of "other"', () => {
    const items = positionItems(['moderator', 'other'], ['Gestionnaire de bots', 'Archiviste'], (id) =>
      id.toUpperCase(),
    );
    expect(items.map((item) => item.label)).toEqual(['MODERATOR', 'Gestionnaire de bots', 'Archiviste']);
    expect(items.map((item) => item.key)).toEqual(['moderator', 'other:0', 'other:1']);
  });

  it('keeps the catalog label for "other" when no words were given', () => {
    expect(positionItems(['other'], [], () => 'Autre')).toEqual([{key: 'other', label: 'Autre', icon: 'work'}]);
  });
});

describe('postStatusView', () => {
  it('colors each status', () => {
    expect(postStatusView('draft')).toEqual({key: 'draft', variant: 'default', neutral: false});
    expect(postStatusView('published')).toEqual({key: 'published', variant: 'accent', neutral: false});
    expect(postStatusView('closed')).toEqual({key: 'closed', variant: 'default', neutral: true});
    expect(postStatusView('hidden')).toEqual({key: 'hidden', variant: 'error', neutral: false});
  });

  it('says expired, in grey, for a published post past its date only', () => {
    expect(postStatusView('published', true)).toEqual({key: 'expired', variant: 'default', neutral: true});
    expect(postStatusView('closed', true).key).toBe('closed');
    expect(postStatusView('draft', true).key).toBe('draft');
  });
});

describe('expiryInfo', () => {
  const now = Date.parse('2026-10-20T12:00:00Z');
  const at = (hours: number) => new Date(now + hours * 3_600_000).toISOString();

  it('knows expired and never', () => {
    expect(expiryInfo(null, false, now)).toEqual({kind: 'never'});
    expect(expiryInfo(null, true, now)).toEqual({kind: 'expired'});
    expect(expiryInfo(at(5), true, now)).toEqual({kind: 'expired'});
    expect(expiryInfo(at(-1), false, now)).toEqual({kind: 'expired'});
  });

  it('counts hours under a day and days after', () => {
    expect(expiryInfo(at(0.2), false, now)).toEqual({kind: 'hours', value: 1});
    expect(expiryInfo(at(5), false, now)).toEqual({kind: 'hours', value: 5});
    expect(expiryInfo(at(23), false, now)).toEqual({kind: 'hours', value: 23});
    expect(expiryInfo(at(24), false, now)).toEqual({kind: 'days', value: 1});
    expect(expiryInfo(at(5 * 24 - 3), false, now)).toEqual({kind: 'days', value: 5});
  });

  it(`is only near within ${EXPIRY_SOON_DAYS} days`, () => {
    expect(expiryIsNear(at(14 * 24), false, now)).toBe(true);
    expect(expiryIsNear(at(14 * 24 + 1), false, now)).toBe(false);
    expect(expiryIsNear(null, false, now)).toBe(false);
    expect(expiryIsNear(null, true, now)).toBe(true);
    expect(expiryInfo(at(40 * 24), false, now).kind).toBe('later');
  });
});

describe('plainExcerpt', () => {
  it('strips markdown and joins lines', () => {
    expect(plainExcerpt('Notre **communauté** de _4 000_ membres,\n\ndisponible ~~jamais~~ ce soir.')).toBe(
      'Notre communauté de 4 000 membres, disponible jamais ce soir.',
    );
  });

  it('keeps the text of a link and drops its address', () => {
    expect(plainExcerpt('Lisez les [règles](https://example.com/r) puis ![logo](https://x.y/z.png).')).toBe(
      'Lisez les règles puis logo.',
    );
  });

  it('drops heading, quote and list marks, and code ticks', () => {
    expect(plainExcerpt('# Titre\n> citation\n- un\n- deux `code`')).toBe('Titre citation un deux code');
  });

  it('leaves ordinary punctuation and snake_case alone', () => {
    expect(plainExcerpt('Rôle mod_discord : 5 h/semaine (soir).')).toBe('Rôle mod_discord : 5 h/semaine (soir).');
    expect(plainExcerpt('   ')).toBe('');
  });
});

describe('links', () => {
  it('shows the host without www', () => {
    expect(linkHost('https://www.example.com/alex?x=1')).toBe('example.com');
    expect(linkHost('https://mastodon.example.social/@alex')).toBe('mastodon.example.social');
  });

  it('refuses anything that is not a web link', () => {
    expect(linkHost('javascript:alert(1)')).toBeNull();
    expect(linkHost('data:text/html,<b>x</b>')).toBeNull();
    expect(linkHost('not a url')).toBeNull();
  });

  it('keeps only the safe ones, with their host', () => {
    expect(
      safeLinks([
        {label: 'Site', url: 'https://example.com'},
        {label: 'Bad', url: 'javascript:alert(1)'},
      ]),
    ).toEqual([{label: 'Site', url: 'https://example.com', host: 'example.com'}]);
  });
});

describe('guildTone', () => {
  it('comes from the id, so a server keeps its color', () => {
    expect(guildTone('812345678901234567')).toBe(guildTone('812345678901234567'));
    const tones = ['0', '1', '2'].map((last) => guildTone(`81234567890123456${last}`));
    expect(new Set(tones).size).toBe(3);
    expect(guildTone('3')).toBe('primary');
    expect(guildTone('4')).toBe('secondary');
    expect(guildTone('5')).toBe('tertiary');
  });

  it('does not throw on an id that is not a number', () => {
    expect(guildTone('not-an-id')).toBe('primary');
  });
});

describe('time zones', () => {
  // 20 October 2026 12:32 UTC: Paris is on summer time (UTC+2) until the 25th.
  const instant = Date.parse('2026-10-20T12:32:00Z');

  it('reads UTC offsets', () => {
    expect(utcOffsetMinutes('UTC+02:00')).toBe(120);
    expect(utcOffsetMinutes('UTC-05:30')).toBe(-330);
    expect(utcOffsetMinutes('UTC+00:00')).toBe(0);
    expect(utcOffsetMinutes('Europe/Paris')).toBeNull();
    expect(utcOffsetMinutes('UTC+2')).toBeNull();
  });

  it('gives the local time in an IANA zone', () => {
    expect(localTime('Europe/Paris', instant, 'fr')).toBe('14:32');
    expect(localTime('America/New_York', instant, 'fr')).toBe('8:32');
    expect(localTime('Asia/Kolkata', instant, 'fr')).toBe('18:02');
  });

  it('gives the local time for a UTC offset, half hours included', () => {
    expect(localTime('UTC+02:00', instant, 'fr')).toBe('14:32');
    expect(localTime('UTC-05:30', instant, 'fr')).toBe('7:02');
    expect(localTime('UTC+00:00', instant, 'fr')).toBe('12:32');
    expect(localTime('UTC+14:00', instant, 'fr')).toBe('2:32');
  });

  it('follows the language for the clock', () => {
    expect(localTime('UTC+02:00', instant, 'en')).toBe('2:32 PM');
    expect(localTime('UTC+02:00', instant, 'de')).toBe('14:32');
  });

  it('follows <html lang> by default', () => {
    document.documentElement.lang = 'fr';
    expect(localTime('UTC+02:00', instant)).toBe('14:32');
  });

  it('is null for a zone the browser does not know', () => {
    expect(localTime('Mars/Olympus', instant, 'fr')).toBeNull();
    expect(localTime('', instant, 'fr')).toBeNull();
  });
});
