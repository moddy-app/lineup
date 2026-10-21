import {fireEvent, render} from '@testing-library/react';
import {afterEach, beforeAll, describe, expect, it} from 'vitest';

import {i18n} from '@/i18n';
import {useFrench} from '@/test/harness';

import {LanguageMenu} from './LanguageMenu';

beforeAll(useFrench);
afterEach(async () => {
  await i18n.changeLanguage('fr');
});

describe('LanguageMenu', () => {
  it('names its button, lists the five languages by their own name and marks the current one', () => {
    const {container} = render(<LanguageMenu />);
    expect(container.querySelector('md-icon-button')?.getAttribute('aria-label')).toBe('Langue');
    const items = [...container.querySelectorAll('md-menu-item')];
    expect(items.map((item) => item.querySelector('[slot="headline"]')?.textContent)).toEqual([
      'English',
      'Français',
      'Español',
      'Português (Brasil)',
      'Deutsch',
    ]);
    const checked = items.filter((item) => item.querySelector('md-icon[slot="end"]'));
    expect(checked).toHaveLength(1);
    expect(checked[0]?.textContent).toContain('Français');
  });

  it('changes the language of the app', async () => {
    const {container} = render(<LanguageMenu />);
    const german = [...container.querySelectorAll('md-menu-item')].find((item) =>
      item.textContent?.includes('Deutsch'),
    );
    fireEvent.click(german as Element);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(document.documentElement.lang).toBe('de');
    expect(i18n.resolvedLanguage).toBe('de');
  });
});
