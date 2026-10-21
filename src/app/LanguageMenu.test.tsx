import {fireEvent, render, screen} from '@testing-library/react';
import {afterEach, beforeAll, describe, expect, it} from 'vitest';

import {i18n} from '@/i18n';
import {useFrench} from '@/test/harness';

import {LanguageMenu} from './LanguageMenu';

beforeAll(useFrench);
afterEach(async () => {
  await i18n.changeLanguage('fr');
});

const open = (container: HTMLElement) => fireEvent.click(container.querySelector('md-icon-button') as Element);

describe('LanguageMenu', () => {
  it('names its button, lists the five languages by their own name and marks the current one', () => {
    const {container} = render(<LanguageMenu />);
    expect(container.querySelector('md-icon-button')?.getAttribute('aria-label')).toBe('Langue');
    open(container);
    const items = screen.getAllByRole('menuitemradio');
    expect(items.map((item) => item.querySelector('.filter-option-label')?.textContent)).toEqual([
      'English',
      'Français',
      'Español',
      'Português (Brasil)',
      'Deutsch',
    ]);
    expect(items.map((item) => item.getAttribute('lang'))).toEqual(['en', 'fr', 'es', 'pt-BR', 'de']);
    const checked = items.filter((item) => item.getAttribute('aria-checked') === 'true');
    expect(checked).toHaveLength(1);
    expect(checked[0]?.textContent).toContain('Français');
  });

  it('changes the language of the app', async () => {
    const {container} = render(<LanguageMenu />);
    open(container);
    fireEvent.click(screen.getByRole('menuitemradio', {name: 'Deutsch'}));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(document.documentElement.lang).toBe('de');
    expect(i18n.resolvedLanguage).toBe('de');
  });
});
