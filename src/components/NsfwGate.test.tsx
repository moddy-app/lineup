import {act, fireEvent, renderHook, screen} from '@testing-library/react';
import {afterEach, beforeAll, beforeEach, describe, expect, it, vi} from 'vitest';

import {i18n} from '@/i18n';
import {json, mockApi, renderApp, useFrench} from '@/test/harness';

import {isNsfw, NSFW_STORAGE_KEY, resetNsfwConfirmed, useNsfwConfirmed} from './nsfw';
import {NsfwConfirmDialog, NsfwGate} from './NsfwGate';
import {renderWithCatalog} from './testUtils';

beforeAll(useFrench);
beforeEach(() => {
  resetNsfwConfirmed();
  window.history.replaceState(null, '', '/');
});
afterEach(() => {
  vi.restoreAllMocks();
  resetNsfwConfirmed();
});

const Secret = () => <p>Contenu derrière l'écran</p>;

describe('isNsfw', () => {
  it('is true for the nsfw badge or the nsfw theme', () => {
    expect(isNsfw({badges: [{id: 'moddy_installed'}, {id: 'nsfw'}]})).toBe(true);
    expect(isNsfw({theme: 'nsfw'})).toBe(true);
    expect(isNsfw({theme: 'gaming', badges: [{id: 'discord_verified'}]})).toBe(false);
    expect(isNsfw({})).toBe(false);
    expect(isNsfw({badges: [], theme: null})).toBe(false);
  });

  it('is true for a directory card or a post whose server is NSFW', () => {
    expect(isNsfw({nsfw: true, theme: 'gaming'})).toBe(true);
    expect(isNsfw({nsfw: false, theme: 'gaming'})).toBe(false);
    expect(isNsfw({theme: 'gaming', guild: {nsfw: true}})).toBe(true);
    expect(isNsfw({theme: 'gaming', guild: {nsfw: false}})).toBe(false);
    expect(isNsfw({theme: 'nsfw', guild: null})).toBe(true);
    expect(isNsfw({theme: null, guild: null})).toBe(false);
  });
});

describe('NsfwGate', () => {
  it('shows its content as it is when the content is not for adults', () => {
    renderWithCatalog(
      <NsfwGate nsfw={false}>
        <Secret />
      </NsfwGate>,
    );
    expect(screen.getByText("Contenu derrière l'écran")).toBeTruthy();
    expect(screen.queryByText('Contenu réservé aux adultes')).toBeNull();
  });

  it('puts a card in front of adult content: a shape, a title, one sentence and two buttons', () => {
    const {container} = renderWithCatalog(
      <NsfwGate nsfw>
        <Secret />
      </NsfwGate>,
    );
    expect(screen.queryByText("Contenu derrière l'écran")).toBeNull();
    expect(screen.getByRole('heading', {level: 2}).textContent).toBe('Contenu réservé aux adultes');
    expect(container.querySelector('.shape')!.textContent).toBe('explicit');
    expect(container.querySelectorAll('p')).toHaveLength(1);
    expect(container.querySelector('md-filled-button')!.textContent).toBe("J'ai 18 ans ou plus, afficher");
    expect(container.querySelector('md-outlined-button')!.textContent).toBe('Retour');
  });

  it('can take the page heading', () => {
    renderWithCatalog(
      <NsfwGate nsfw headingLevel={1}>
        <Secret />
      </NsfwGate>,
    );
    expect(screen.getByRole('heading', {level: 1})).toBeTruthy();
  });

  it('shows the content once confirmed, and remembers it on this device', () => {
    const {unmount} = renderWithCatalog(
      <NsfwGate nsfw>
        <Secret />
      </NsfwGate>,
    );
    fireEvent.click(screen.getByText("J'ai 18 ans ou plus, afficher"));
    expect(screen.getByText("Contenu derrière l'écran")).toBeTruthy();
    expect(window.localStorage.getItem(NSFW_STORAGE_KEY)).toBe('true');
    unmount();

    // Another visit: no screen any more.
    renderWithCatalog(
      <NsfwGate nsfw>
        <Secret />
      </NsfwGate>,
    );
    expect(screen.getByText("Contenu derrière l'écran")).toBeTruthy();
    expect(screen.queryByText('Contenu réservé aux adultes')).toBeNull();
  });

  it('is open for every gate on the page once one is confirmed', () => {
    renderWithCatalog(
      <>
        <NsfwGate nsfw>
          <p>Premier</p>
        </NsfwGate>
        <NsfwGate nsfw>
          <p>Second</p>
        </NsfwGate>
      </>,
    );
    fireEvent.click(screen.getAllByText("J'ai 18 ans ou plus, afficher")[0]!);
    expect(screen.getByText('Premier')).toBeTruthy();
    expect(screen.getByText('Second')).toBeTruthy();
  });

  it('keeps the confirmation for the page when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    renderWithCatalog(
      <NsfwGate nsfw>
        <Secret />
      </NsfwGate>,
    );
    fireEvent.click(screen.getByText("J'ai 18 ans ou plus, afficher"));
    expect(screen.getByText("Contenu derrière l'écran")).toBeTruthy();
    expect(window.localStorage.getItem(NSFW_STORAGE_KEY)).toBeNull();
  });

  it('goes to the feed on "Retour" when there is no page behind, or to the page asked for', async () => {
    mockApi({'GET /lineup/me': () => json(401, {error: 'Non authentifie'})});
    const routes = [
      {index: true, element: <p>FIL</p>},
      {path: 'servers', element: <p>ANNUAIRE</p>},
      {
        path: 'guild',
        element: (
          <NsfwGate nsfw>
            <Secret />
          </NsfwGate>
        ),
      },
      {
        path: 'guild-with-back',
        element: (
          <NsfwGate nsfw backTo="/servers">
            <Secret />
          </NsfwGate>
        ),
      },
    ];
    const first = renderApp(routes, {path: '/guild'});
    fireEvent.click(await screen.findByText('Retour'));
    await screen.findByText('FIL');
    first.unmount();

    renderApp(routes, {path: '/guild-with-back'});
    fireEvent.click(await screen.findByText('Retour'));
    await screen.findByText('ANNUAIRE');
  });

  it('speaks the language of the page', async () => {
    renderWithCatalog(
      <NsfwGate nsfw>
        <Secret />
      </NsfwGate>,
    );
    await act(() => i18n.changeLanguage('en'));
    expect(screen.getByText('Adults only')).toBeTruthy();
    expect(screen.getByText('I am 18 or older, show it')).toBeTruthy();
    await act(() => i18n.changeLanguage('fr'));
  });
});

describe('useNsfwConfirmed', () => {
  it('is false at first, then true everywhere after confirm, and reads a stored confirmation', () => {
    const first = renderHook(() => useNsfwConfirmed());
    const second = renderHook(() => useNsfwConfirmed());
    expect(first.result.current.confirmed).toBe(false);
    act(() => first.result.current.confirm());
    expect(first.result.current.confirmed).toBe(true);
    expect(second.result.current.confirmed).toBe(true);
    expect(window.localStorage.getItem(NSFW_STORAGE_KEY)).toBe('true');
  });

  it('ignores a corrupt stored value', () => {
    window.localStorage.setItem(NSFW_STORAGE_KEY, '{not json');
    const {result} = renderHook(() => useNsfwConfirmed());
    expect(result.current.confirmed).toBe(false);
  });
});

describe('NsfwConfirmDialog (the feed switch)', () => {
  it('records the confirmation, then tells the feed to go on', () => {
    const onConfirmed = vi.fn();
    const onCancel = vi.fn();
    renderWithCatalog(<NsfwConfirmDialog open onConfirmed={onConfirmed} onCancel={onCancel} />);
    expect(screen.getByText('Contenus réservés aux adultes')).toBeTruthy();
    fireEvent.click(screen.getByText('Annuler'));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem(NSFW_STORAGE_KEY)).toBeNull();

    fireEvent.click(screen.getByText("J'ai 18 ans ou plus, continuer"));
    expect(onConfirmed).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem(NSFW_STORAGE_KEY)).toBe('true');
  });
});
