import {act, screen, waitFor} from '@testing-library/react';
import {afterEach, beforeAll, beforeEach, describe, expect, it, vi} from 'vitest';

import {makeMe, makePost, page, infinite} from '@/api/fixtures';
import {queryKeys} from '@/api/queryKeys';
import {browser} from '@/lib/browser';
import {captureHook, json, mockApi, renderApp, useFrench} from '@/test/harness';

import {consumeAuthError, takeAuthError} from './authError';
import {registerBeforeLogin} from './beforeLogin';
import {type Session, useSession} from './session';

const captured = captureHook(useSession);
const session = new Proxy({} as Session, {get: (_target, key) => captured.current()[key as keyof Session]});

function Probe() {
  const {status} = useSession();
  return (
    <>
      <captured.Capture />
      <p data-testid="status">{status}</p>
    </>
  );
}

const sanction = {
  code: 'user_suspended',
  level: 'ban',
  subject_type: 'discord_user',
  subject_id: '1234567890123456789',
  references: ['A7F2K9'],
  expires_at: null,
  message: 'Votre accès à Moddy est suspendu.',
  violations_url: 'https://moddy.app/violations',
};

const status = () => screen.getByTestId('status').textContent;
const mount = (options?: {path?: string}) =>
  renderApp(
    [
      {index: true, element: <Probe />},
      {path: '*', element: <Probe />},
    ],
    options,
  );

beforeAll(useFrench);
beforeEach(() => {
  window.history.replaceState(null, '', '/');
  takeAuthError();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('SessionProvider: the status', () => {
  it('is authenticated with the person on a 200', async () => {
    mockApi({'GET /lineup/me': () => json(200, makeMe({username: 'alex'}))});
    mount();
    expect(status()).toBe('loading');
    await waitFor(() => expect(status()).toBe('authenticated'));
    expect(session.me?.user.username).toBe('alex');
  });

  it('is anonymous on a 401, with one request and no retry', async () => {
    const api = mockApi({'GET /lineup/me': () => json(401, {error: 'Non authentifie'})});
    mount();
    await waitFor(() => expect(status()).toBe('anonymous'));
    expect(session.error).toBeUndefined();
    expect(api.calls).toHaveLength(1);
  });

  it('is suspended on a 403 user_suspended, with the sanction, and no retry', async () => {
    const api = mockApi({'GET /lineup/me': () => json(403, {error: sanction})});
    mount();
    await waitFor(() => expect(status()).toBe('suspended'));
    expect(session.sanction?.references).toEqual(['A7F2K9']);
    expect(session.sanction?.violations_url).toBe('https://moddy.app/violations');
    expect(session.me).toBeUndefined();
    expect(api.calls).toHaveLength(1);
  });

  it('degrades to anonymous when the API cannot be reached, after a single retry', async () => {
    const api = mockApi({
      'GET /lineup/me': () => {
        throw new TypeError('Failed to fetch');
      },
    });
    mount();
    await waitFor(() => expect(status()).toBe('anonymous'));
    expect(session.error?.kind).toBe('network');
    expect(api.calls).toHaveLength(2);
  });

  it('is anonymous too on a 500, without retrying', async () => {
    const api = mockApi({'GET /lineup/me': () => json(500, {oops: true})});
    mount();
    await waitFor(() => expect(status()).toBe('anonymous'));
    expect(session.error?.status).toBe(500);
    expect(api.calls).toHaveLength(1);
  });

  it('refresh asks again, and a person who signed in elsewhere shows up', async () => {
    let signedIn = false;
    mockApi({'GET /lineup/me': () => (signedIn ? json(200, makeMe()) : json(401, {error: 'Non authentifie'}))});
    mount();
    await waitFor(() => expect(status()).toBe('anonymous'));
    signedIn = true;
    act(() => session.refresh());
    await waitFor(() => expect(status()).toBe('authenticated'));
  });
});

describe('login', () => {
  it('saves drafts, then goes to the API sign-in for the current page', async () => {
    mockApi({'GET /lineup/me': () => json(401, {error: 'Non authentifie'})});
    const navigate = vi.spyOn(browser, 'navigate').mockImplementation(() => {});
    const order: string[] = [];
    const unregister = registerBeforeLogin(() => order.push('saved'));
    navigate.mockImplementation(() => void order.push('navigated'));
    mount();
    await waitFor(() => expect(status()).toBe('anonymous'));

    session.login();
    expect(order).toEqual(['saved', 'navigated']);
    const url = new URL(navigate.mock.calls[0]![0]);
    expect(url.pathname).toBe('/lineup/auth/login');
    // The test page lives on localhost: it is sent as a path, which the API attaches to lineup.moddy.app.
    expect(url.searchParams.get('redirect')).toBe('/');
    unregister();
  });

  it('passes the destination it is given', async () => {
    mockApi({'GET /lineup/me': () => json(401, {error: 'Non authentifie'})});
    const navigate = vi.spyOn(browser, 'navigate').mockImplementation(() => {});
    mount();
    await waitFor(() => expect(status()).toBe('anonymous'));
    session.login('https://lineup.moddy.app/posts/abc?x=1');
    expect(new URL(navigate.mock.calls[0]![0]).searchParams.get('redirect')).toBe(
      'https://lineup.moddy.app/posts/abc?x=1',
    );
  });

  it('requireAuth lets a signed-in person through and sends an anonymous one to sign in', async () => {
    const navigate = vi.spyOn(browser, 'navigate').mockImplementation(() => {});
    mockApi({'GET /lineup/me': () => json(200, makeMe())});
    const signedIn = mount();
    await waitFor(() => expect(status()).toBe('authenticated'));
    expect(session.requireAuth()).toBe(true);
    expect(navigate).not.toHaveBeenCalled();
    signedIn.unmount();

    mockApi({'GET /lineup/me': () => json(401, {error: 'Non authentifie'})});
    mount();
    await waitFor(() => expect(status()).toBe('anonymous'));
    expect(session.requireAuth()).toBe(false);
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('requireAuth neither signs in nor passes while suspended', async () => {
    const navigate = vi.spyOn(browser, 'navigate').mockImplementation(() => {});
    mockApi({'GET /lineup/me': () => json(403, {error: sanction})});
    mount();
    await waitFor(() => expect(status()).toBe('suspended'));
    expect(session.requireAuth()).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe('logout', () => {
  it('signs out, forgets the person’s data, keeps the catalog, goes home and says so', async () => {
    const api = mockApi({
      'GET /lineup/me': () => json(200, makeMe()),
      'POST /auth/logout': () => json(204),
    });
    const app = mount({path: '/guilds/42'});
    await waitFor(() => expect(status()).toBe('authenticated'));
    app.queryClient.setQueryData(queryKeys.catalog(), {positions: []});
    app.queryClient.setQueryData(queryKeys.feed({}), infinite(page([makePost()])));
    app.queryClient.setQueryData(queryKeys.myProfile(), {id: '1'});

    await act(async () => {
      await session.logout();
    });

    expect(api.calls.some((call) => call.method === 'POST' && call.path === '/auth/logout')).toBe(true);
    await waitFor(() => expect(status()).toBe('anonymous'));
    expect(app.router.state.location.pathname).toBe('/');
    expect(app.queryClient.getQueryData(queryKeys.feed({}))).toBeUndefined();
    expect(app.queryClient.getQueryData(queryKeys.myProfile())).toBeUndefined();
    expect(app.queryClient.getQueryData(queryKeys.catalog())).toEqual({positions: []});
    expect(screen.getByText('Vous êtes déconnecté')).toBeTruthy();
    // No new request for the session: it is anonymous by itself.
    expect(api.calls.filter((call) => call.path === '/lineup/me')).toHaveLength(1);
  });

  it('counts an already expired session as signed out', async () => {
    mockApi({
      'GET /lineup/me': () => json(200, makeMe()),
      'POST /auth/logout': () => json(401, {error: 'Session expiree'}),
    });
    const app = mount();
    await waitFor(() => expect(status()).toBe('authenticated'));
    await act(async () => {
      await session.logout();
    });
    await waitFor(() => expect(status()).toBe('anonymous'));
    expect(app.router.state.location.pathname).toBe('/');
  });

  it('stays signed in and says why when the request fails', async () => {
    mockApi({
      'GET /lineup/me': () => json(200, makeMe()),
      'POST /auth/logout': () => {
        throw new TypeError('Failed to fetch');
      },
    });
    const app = mount({path: '/guilds/42'});
    await waitFor(() => expect(status()).toBe('authenticated'));
    app.queryClient.setQueryData(queryKeys.myProfile(), {id: '1'});
    await act(async () => {
      await session.logout();
    });
    expect(status()).toBe('authenticated');
    expect(app.router.state.location.pathname).toBe('/guilds/42');
    expect(app.queryClient.getQueryData(queryKeys.myProfile())).toEqual({id: '1'});
    expect(screen.getByText('Connexion impossible. Vérifiez votre réseau.')).toBeTruthy();
  });
});

describe('?auth_error=', () => {
  it('tells a refused sign-in, once, and the parameter is already gone from the address', async () => {
    mockApi({'GET /lineup/me': () => json(401, {error: 'Non authentifie'})});
    window.history.replaceState(null, '', '/guilds?q=a&auth_error=access_denied');
    consumeAuthError();
    expect(window.location.search).toBe('?q=a');
    mount();
    await waitFor(() => expect(screen.getByText('Connexion annulée')).toBeTruthy());
  });

  it('words any other failure generically', async () => {
    mockApi({'GET /lineup/me': () => json(401, {error: 'Non authentifie'})});
    window.history.replaceState(null, '', '/?auth_error=server_error');
    consumeAuthError();
    mount();
    await waitFor(() => expect(screen.getByText("La connexion n'a pas abouti")).toBeTruthy());
  });

  it('says nothing when there is no parameter', async () => {
    mockApi({'GET /lineup/me': () => json(401, {error: 'Non authentifie'})});
    const app = mount();
    await waitFor(() => expect(status()).toBe('anonymous'));
    expect(app.container.querySelector('.snackbar-message')).toBeNull();
  });
});
