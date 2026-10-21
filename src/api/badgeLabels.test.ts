import {describe, expect, it} from 'vitest';

import {LANGUAGE_CODES} from '@/i18n/languages';

import {BADGE_LABEL_OVERRIDES} from './badgeLabels';
import {catalogFixture} from './catalog.fixture';

describe('badge label overrides', () => {
  it('covers every language, for badges of the catalog', () => {
    const ids = new Set(catalogFixture.badges.map((entry) => entry.id as string));
    for (const [id, labels] of Object.entries(BADGE_LABEL_OVERRIDES)) {
      expect(ids.has(id), id).toBe(true);
      for (const language of LANGUAGE_CODES) expect(labels[language]?.trim(), `${id}.${language}`).toBeTruthy();
    }
  });

  it('says what a badge is, not who grants it', () => {
    expect(BADGE_LABEL_OVERRIDES.lineup_verified?.en).toBe('Verified');
    expect(BADGE_LABEL_OVERRIDES.moddy_partner?.fr).toBe('Partenaire');
  });
});
