import {act, fireEvent, screen, within} from '@testing-library/react';
import {useState} from 'react';
import {afterEach, beforeAll, beforeEach, describe, expect, it, vi} from 'vitest';

import {useFrench} from '@/test/harness';

import {renderWithCatalog} from '../testUtils';
import {FilterBar} from './FilterBar';
import type {FilterDefinition} from './types';

beforeAll(useFrench);
beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

const POSITIONS = [
  {value: 'moderator', label: 'Modérateur'},
  {value: 'developer', label: 'Développeur'},
];
const LANGUAGES = [
  {value: 'fr', label: 'Français'},
  {value: 'en', label: 'Anglais'},
];

function Harness({
  initial = {},
  onSearch,
}: {
  initial?: {position?: string[]; language?: string[]};
  onSearch?: (value: string) => void;
}) {
  const [position, setPosition] = useState<string[]>(initial.position ?? []);
  const [language, setLanguage] = useState<string[]>(initial.language ?? []);
  const filters: Record<'position' | 'language', FilterDefinition> = {
    position: {icon: 'work', label: 'Poste', kind: 'multi', options: POSITIONS, value: position, onChange: setPosition},
    language: {
      icon: 'translate',
      label: 'Langue',
      kind: 'single',
      options: LANGUAGES,
      value: language,
      onChange: setLanguage,
    },
  };
  return (
    <FilterBar
      search={{value: '', onChange: onSearch ?? (() => {}), placeholder: 'Rechercher'}}
      filters={filters}
      trailing={<button type="button">extra</button>}
    />
  );
}

const chip = (name: RegExp | string) => screen.queryByRole('button', {name});
/** Opens the add menu from the funnel and picks a filter. */
const openFunnel = () => fireEvent.click(document.querySelector('md-icon-button.filter-toggle') as Element);
const pick = (label: string) => {
  openFunnel();
  fireEvent.click(screen.getByRole('menuitem', {name: new RegExp(label)}));
};
const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

describe('FilterBar', () => {
  it('shows only the toolbar when no filter is active, with the extra buttons', () => {
    const {container} = renderWithCatalog(<Harness />);
    expect(container.querySelector('.filter-chips')).toBeNull();
    expect(screen.getByRole('button', {name: 'extra'})).toBeTruthy();
    expect(container.querySelector('md-icon-button.filter-toggle')?.getAttribute('aria-label')).toBe('Filtres');
  });

  it('starts with a chip for each filter that already has a value (a shared link)', () => {
    renderWithCatalog(<Harness initial={{position: ['developer'], language: ['fr']}} />);
    expect(chip(/Poste/)?.textContent).toContain('Développeur');
    expect(chip(/Langue/)?.textContent).toContain('Français');
    // Every filter is used: no "+ Ajouter un filtre" chip.
    expect(chip(/Ajouter un filtre/)).toBeNull();
  });

  it('adds a chip, opens its popover 160 ms later and ignores a close in the first 250 ms', () => {
    renderWithCatalog(<Harness />);
    pick('Poste');
    expect(chip(/Poste/)).not.toBeNull();
    expect(screen.queryByRole('group', {name: 'Poste'})).toBeNull();
    advance(159);
    expect(screen.queryByRole('group', {name: 'Poste'})).toBeNull();
    advance(1);
    expect(screen.getByRole('group', {name: 'Poste'})).toBeTruthy();
    // A press outside right after opening does nothing.
    fireEvent.pointerDown(document.body);
    advance(100);
    expect(screen.getByRole('group', {name: 'Poste'})).toBeTruthy();
    // After 250 ms it closes, and as it has no value the chip goes.
    advance(200);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('group', {name: 'Poste'})).toBeNull();
    expect(chip(/Poste/)).toBeNull();
  });

  it('keeps a multiple filter open while choosing, and shows the values in the chip', () => {
    renderWithCatalog(<Harness />);
    pick('Poste');
    advance(160);
    const popover = screen.getByRole('group', {name: 'Poste'});
    fireEvent.click(within(popover).getByRole('button', {name: 'Modérateur'}));
    fireEvent.click(within(popover).getByRole('button', {name: 'Développeur'}));
    expect(screen.getByRole('group', {name: 'Poste'})).toBeTruthy();
    expect(within(popover).getByRole('button', {name: 'Modérateur'}).getAttribute('aria-pressed')).toBe('true');
    expect(chip(/Poste/)?.textContent).toContain('Modérateur, Développeur');
    // Clicking a selected option clears it.
    fireEvent.click(within(popover).getByRole('button', {name: 'Modérateur'}));
    expect(chip(/Poste/)?.textContent).toContain('Développeur');
    expect(chip(/Poste/)?.textContent).not.toContain('Modérateur');
  });

  it('closes a single filter after a choice and keeps the chip', () => {
    renderWithCatalog(<Harness />);
    pick('Langue');
    advance(160);
    fireEvent.click(within(screen.getByRole('group', {name: 'Langue'})).getByRole('button', {name: 'Anglais'}));
    expect(screen.queryByRole('group', {name: 'Langue'})).toBeNull();
    expect(chip(/Langue/)?.textContent).toContain('Anglais');
  });

  it('removes the chip with "Retirer"', () => {
    renderWithCatalog(<Harness initial={{language: ['fr']}} />);
    fireEvent.click(chip(/Langue/) as Element);
    advance(0);
    const popover = screen.getByRole('group', {name: 'Langue'});
    fireEvent.click(within(popover).getByRole('button', {name: 'Retirer'}));
    expect(chip(/Langue/)).toBeNull();
  });

  it('closes on Escape (even right after opening) and a popover left empty removes its chip', () => {
    renderWithCatalog(<Harness />);
    pick('Poste');
    advance(160);
    fireEvent.keyDown(screen.getByRole('group', {name: 'Poste'}), {key: 'Escape'});
    expect(screen.queryByRole('group', {name: 'Poste'})).toBeNull();
    expect(chip(/Poste/)).toBeNull();
  });

  it('offers "+ Ajouter un filtre" while filters remain, and a message when all are used', () => {
    renderWithCatalog(<Harness initial={{position: ['developer']}} />);
    expect(chip(/Ajouter un filtre/)).not.toBeNull();
    // Only the unused filter is in the menu.
    fireEvent.click(chip(/Ajouter un filtre/) as Element);
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['translateLangue']);
    fireEvent.click(screen.getByRole('menuitem', {name: /Langue/}));
    advance(160);
    fireEvent.click(within(screen.getByRole('group', {name: 'Langue'})).getByRole('button', {name: 'Français'}));
    expect(chip(/Ajouter un filtre/)).toBeNull();
    openFunnel();
    expect(screen.getByRole('menu').textContent).toContain('Tous les filtres sont utilisés');
  });

  it('orders chips by addition', () => {
    const {container} = renderWithCatalog(<Harness />);
    pick('Langue');
    advance(160);
    fireEvent.click(within(screen.getByRole('group', {name: 'Langue'})).getByRole('button', {name: 'Anglais'}));
    pick('Poste');
    advance(160);
    fireEvent.click(within(screen.getByRole('group', {name: 'Poste'})).getByRole('button', {name: 'Modérateur'}));
    const labels = [...container.querySelectorAll('.filter-chip-label')].map((node) => node.textContent);
    expect(labels).toEqual(['Langue:', 'Poste:']);
  });
});
