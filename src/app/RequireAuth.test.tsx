import {fireEvent, screen, waitFor} from '@testing-library/react';
import {afterEach, beforeAll, describe, expect, it, vi} from 'vitest';

import {makeMe} from '@/api/fixtures';
import {browser} from '@/lib/browser';
import {json, mockApi, renderApp, useFrench} from '@/test/harness';

import {RequireAuth} from './RequireAuth';
import {SuspendedNotice} from './SuspendedNotice';

const sanction = {
  code: 'user_suspended',
  level: 'ban',
  subject_type: 'discord_user',
  subject_id: '1234567890123456789',
  references: ['A7F2K9', 'B3C4D5'],
  expires_at: null,
  message: 'Votre accès à Moddy est suspendu.',
  violations_url: 'https://moddy.app/violations',
};

const routes = [
  {
    element: <RequireAuth purpose="profile" />,
    children: [{path: 'private', element: <p>Contenu privé</p>}],
  },
  {
    element: <RequireAuth purpose="default" staff />,
    children: [{path: 'console', element: <p>Console staff</p>}],
  },
  {path: 'public', element: <SuspendedNotice />},
];

beforeAll(useFrench);
afterEach(() => {
  window.history.replaceState(null, '', '/');
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('RequireAuth', () => {
  it('shows a loader while the session is read, never the page', async () => {
    mockApi({'GET /lineup/me': () => new Promise(() => {})});
    renderApp(routes, {path: '/private'});
    expect(screen.queryByText('Contenu privé')).toBeNull();
    expect(screen.queryByText('Connectez-vous pour continuer')).toBeNull();
    expect(document.querySelector('md-circular-progress')).not.toBeNull();
  });

  it('shows the sign-in prompt to an anonymous visitor, and signs in to this very page', async () => {
    const navigate = vi.spyOn(browser, 'navigate').mockImplementation(() => {});
    mockApi({'GET /lineup/me': () => json(401, {error: 'Non authentifie'})});
    // The memory router does not move the address bar; the real browser router does.
    window.history.replaceState(null, '', '/private');
    renderApp(routes, {path: '/private'});

    await waitFor(() =>
      expect(screen.getByRole('heading', {level: 1}).textContent).toBe('Connectez-vous pour continuer'),
    );
    expect(screen.getByText(/Modifiez votre profil public/)).toBeTruthy();
    expect(document.querySelector('.page.special')).not.toBeNull();
    expect(screen.queryByText('Contenu privé')).toBeNull();

    const button = screen.getByText('Se connecter avec Discord');
    fireEvent.click(button);
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(new URL(navigate.mock.calls[0]![0]).searchParams.get('redirect')).toBe('/private');
  });

  it('shows the page to a signed-in person', async () => {
    mockApi({'GET /lineup/me': () => json(200, makeMe())});
    renderApp(routes, {path: '/private'});
    await waitFor(() => expect(screen.getByText('Contenu privé')).toBeTruthy());
  });

  it('shows the suspension screen to a suspended account: title, references, no end date, the sanction', async () => {
    mockApi({'GET /lineup/me': () => json(403, {error: sanction})});
    renderApp(routes, {path: '/private'});

    await waitFor(() =>
      expect(screen.getByRole('heading', {level: 1}).textContent).toBe('Votre accès à Moddy est suspendu.'),
    );
    expect(screen.queryByText('Contenu privé')).toBeNull();
    expect([...document.querySelectorAll('.pill')].map((pill) => pill.textContent)).toEqual(['A7F2K9', 'B3C4D5']);
    expect(screen.getByText('Sans date de fin')).toBeTruthy();
    const link = document.querySelector('md-filled-button[href]');
    expect(link?.getAttribute('href')).toBe('https://moddy.app/violations');
    expect(link?.getAttribute('target')).toBe('_blank');
    // One filled button, three at most.
    expect(document.querySelectorAll('md-filled-button')).toHaveLength(1);
    expect(document.querySelectorAll('.card-actions > *').length).toBeLessThanOrEqual(3);
  });

  it('writes the end date of a sanction that has one', async () => {
    mockApi({'GET /lineup/me': () => json(403, {error: {...sanction, expires_at: '2027-01-15T00:00:00+00:00'}})});
    renderApp(routes, {path: '/private'});
    await waitFor(() => expect(screen.getByText(/^Jusqu'au /)).toBeTruthy());
    expect(screen.queryByText('Sans date de fin')).toBeNull();
  });

  it('does not render a link that is not https', async () => {
    mockApi({'GET /lineup/me': () => json(403, {error: {...sanction, violations_url: 'javascript:alert(1)'}})});
    renderApp(routes, {path: '/private'});
    await waitFor(() => expect(screen.getByRole('heading', {level: 1})).toBeTruthy());
    expect(document.querySelector('md-filled-button')).toBeNull();
  });

  it('says the session could not be read when the API is unreachable, and tries again on request', async () => {
    let up = false;
    mockApi({
      'GET /lineup/me': () => {
        if (!up) throw new TypeError('Failed to fetch');
        return json(200, makeMe());
      },
    });
    renderApp(routes, {path: '/private'});
    await waitFor(() => expect(screen.getByText('Impossible de vérifier votre session')).toBeTruthy());
    expect(screen.getByText('Connexion impossible. Vérifiez votre réseau.')).toBeTruthy();
    expect(screen.queryByText('Connectez-vous pour continuer')).toBeNull();

    up = true;
    fireEvent.click(screen.getByText('Réessayer'));
    await waitFor(() => expect(screen.getByText('Contenu privé')).toBeTruthy());
  });

  describe('staff routes', () => {
    it('show the console to staff', async () => {
      mockApi({'GET /lineup/me': () => json(200, makeMe({is_staff: true}))});
      renderApp(routes, {path: '/console'});
      await waitFor(() => expect(screen.getByText('Console staff')).toBeTruthy());
    });

    it('answer the 404 to everyone else, without revealing the console', async () => {
      mockApi({'GET /lineup/me': () => json(200, makeMe({is_staff: false}))});
      renderApp(routes, {path: '/console'});
      await waitFor(() => expect(screen.getByRole('heading', {level: 1}).textContent).toBe('Page introuvable'));
      expect(screen.queryByText('Console staff')).toBeNull();
    });

    it('ask an anonymous visitor to sign in, in general terms', async () => {
      mockApi({'GET /lineup/me': () => json(401, {error: 'Non authentifie'})});
      renderApp(routes, {path: '/console'});
      await waitFor(() => expect(screen.getByText('Cette page demande un compte Discord.')).toBeTruthy());
    });
  });
});

describe('SuspendedNotice', () => {
  it('shows on a public page of a suspended account, with the sanction and no way to dismiss it', async () => {
    mockApi({'GET /lineup/me': () => json(403, {error: sanction})});
    renderApp(routes, {path: '/public'});
    await waitFor(() => expect(screen.getByText('Votre accès à Moddy est suspendu.')).toBeTruthy());
    expect(
      screen.getByText('Lineup est en lecture seule pour vous. Vous ne pouvez plus publier ni modifier.'),
    ).toBeTruthy();
    expect([...document.querySelectorAll('.pill')].map((pill) => pill.textContent)).toEqual(['A7F2K9', 'B3C4D5']);
    expect(document.querySelector('[aria-label="Fermer"], .snackbar-action')).toBeNull();
  });

  it('is absent for everyone else', async () => {
    mockApi({'GET /lineup/me': () => json(200, makeMe())});
    const app = renderApp(routes, {path: '/public'});
    await waitFor(() => expect(mockApiCalled()).toBe(true));
    expect(app.container.querySelector('.suspended-notice')).toBeNull();
  });
});

function mockApiCalled() {
  return (fetch as unknown as {mock: {calls: unknown[]}}).mock.calls.length > 0;
}
