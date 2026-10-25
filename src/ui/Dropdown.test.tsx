import {fireEvent, render, screen} from '@testing-library/react';
import {useState} from 'react';
import {describe, expect, it, vi} from 'vitest';

import {Dropdown} from './Dropdown';
import {Select} from './Select';

function Menu({onPick}: {onPick: (key: string) => void}) {
  return (
    <Dropdown
      label="Actions"
      items={[
        {key: 'a', label: 'Modifier', icon: 'edit', onSelect: () => onPick('a')},
        {key: 'b', label: 'Fermer', disabled: true, onSelect: () => onPick('b')},
        {key: 'c', label: 'Supprimer', destructive: true, onSelect: () => onPick('c')},
      ]}
      trigger={({ref, onActivate, ...aria}) => (
        <button type="button" {...aria} ref={ref} onClick={onActivate}>
          Ouvrir
        </button>
      )}
    />
  );
}

describe('Dropdown', () => {
  it('opens under its trigger as a menu, in a portal, and marks the trigger expanded', () => {
    render(<Menu onPick={() => {}} />);
    const trigger = screen.getByRole('button', {name: 'Ouvrir'});
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    const menu = screen.getByRole('menu', {name: 'Actions'});
    expect(menu.parentElement).toBe(document.body);
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'editModifier',
      'Fermer',
      'Supprimer',
    ]);
  });

  it('inside an md-dialog, goes into the slotted element of the trigger (md-dialog has no default slot)', () => {
    const dialog = document.createElement('md-dialog');
    const content = document.createElement('div');
    content.slot = 'content';
    dialog.append(content);
    document.body.append(dialog);
    render(<Menu onPick={() => {}} />, {container: content});
    fireEvent.click(screen.getByRole('button', {name: 'Ouvrir'}));
    expect(screen.getByRole('menu').parentElement).toBe(content);
    dialog.remove();
  });

  it('stays open on a keepOpen choice and focuses the new choices (a submenu)', () => {
    function Sub() {
      const [sub, setSub] = useState(false);
      return (
        <Dropdown
          label="Menu"
          items={
            sub
              ? [{key: 'x', label: 'Choix', onSelect: () => {}}]
              : [{key: 'open', label: 'Sous-menu', keepOpen: true, onSelect: () => setSub(true)}]
          }
          trigger={({ref, onActivate, ...aria}) => (
            <button type="button" {...aria} ref={ref} onClick={onActivate}>
              Ouvrir
            </button>
          )}
        />
      );
    }
    render(<Sub />);
    fireEvent.click(screen.getByRole('button', {name: 'Ouvrir'}));
    fireEvent.click(screen.getByRole('menuitem', {name: 'Sous-menu'}));
    expect(screen.getByRole('menu')).not.toBeNull();
    expect(document.activeElement?.textContent).toBe('Choix');
  });

  it('chooses with a click and closes', () => {
    const onPick = vi.fn();
    render(<Menu onPick={onPick} />);
    fireEvent.click(screen.getByRole('button', {name: 'Ouvrir'}));
    fireEvent.click(screen.getByRole('menuitem', {name: 'Supprimer'}));
    expect(onPick).toHaveBeenCalledWith('c');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('moves with the arrow keys over enabled choices, and closes on Escape', () => {
    render(<Menu onPick={() => {}} />);
    fireEvent.click(screen.getByRole('button', {name: 'Ouvrir'}));
    const menu = screen.getByRole('menu');
    expect(document.activeElement?.textContent).toBe('editModifier');
    fireEvent.keyDown(menu, {key: 'ArrowDown'});
    expect(document.activeElement?.textContent).toBe('Supprimer');
    fireEvent.keyDown(menu, {key: 'ArrowDown'});
    expect(document.activeElement?.textContent).toBe('editModifier');
    fireEvent.keyDown(document, {key: 'Escape'});
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('closes on a press outside', () => {
    render(<Menu onPick={() => {}} />);
    fireEvent.click(screen.getByRole('button', {name: 'Ouvrir'}));
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
  });
});

describe('Select', () => {
  function Harness() {
    const [value, setValue] = useState('b');
    return (
      <Select
        label="Thème"
        value={value}
        onValueChange={setValue}
        options={[
          {value: 'a', label: 'Alpha'},
          {value: 'b', label: 'Bravo'},
        ]}
        errorText="Invalide"
      />
    );
  }

  it('shows the label and the value, and a listbox with the current option selected', () => {
    render(<Harness />);
    const trigger = screen.getByRole('button', {name: /Thème/});
    expect(trigger.textContent).toContain('Bravo');
    expect(screen.getByText('Invalide')).toBeTruthy();
    fireEvent.click(trigger);
    const options = screen.getAllByRole('option');
    expect(options.map((option) => option.getAttribute('aria-selected'))).toEqual(['false', 'true']);
    fireEvent.click(options[0]!);
    expect(trigger.textContent).toContain('Alpha');
  });
});
