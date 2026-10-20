import {act, screen, waitFor} from '@testing-library/react';
import {afterEach, beforeAll, describe, expect, it, vi} from 'vitest';

import {ApiError} from '@/api/client';
import {makeMe} from '@/api/fixtures';
import {browser} from '@/lib/browser';
import {captureHook, json, mockApi, renderApp, useFrench} from '@/test/harness';

import {registerBeforeLogin} from './beforeLogin';
import {reauthUrl, REAUTH_DELAY_MS, useReauthenticate} from './reauth';
import {useAuthAction, type AuthAction} from './useAuthAction';
import {useSession} from './session';

const captured = captureHook(() => ({
  auth: useAuthAction(),
  reauthenticate: useReauthenticate(),
}));
const auth = new Proxy({} as AuthAction, {get: (_target, key) => captured.current().auth[key as keyof AuthAction]});
const reauthenticate = (error?: unknown) => captured.current().reauthenticate(error);

function Probe() {
  const {status} = useSession();
  return (
    <>
      <captured.Capture />
      <p data-testid="status">{status}</p>
    </>
  );
}

const unauthenticated = () => new ApiError({status: 401, kind: 'text', code: 'unauthenticated'});

async function mountAs(me: 'user' | 'anonymous' | 'suspended') {
  mockApi({
    'GET /lineup/me': () =>
      me === 'user'
        ? json(200, makeMe())
        : me === 'anonymous'
          ? json(401, {error: 'Non authentifie'})
          : json(403, {error: {code: 'user_suspended', references: [], message: 'm'}}),
  });
  const app = renderApp([{index: true, element: <Probe />}]);
  await waitFor(() => expect(screen.getByTestId('status').textContent).not.toBe('loading'));
  return app;
}

beforeAll(useFrench);
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('useAuthAction().run', () => {
  it('runs the action for a signed-in person', async () => {
    const navigate = vi.spyOn(browser, 'navigate').mockImplementation(() => {});
    await mountAs('user');
    const action = vi.fn().mockResolvedValue('done');
    await expect(auth.run(action)).resolves.toBe('done');
    expect(action).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('signs an anonymous visitor in instead of running it, saving drafts first', async () => {
    const navigate = vi.spyOn(browser, 'navigate').mockImplementation(() => {});
    const saved = vi.fn();
    const unregister = registerBeforeLogin(saved);
    await mountAs('anonymous');
    const action = vi.fn();
    await expect(auth.run(action)).resolves.toBeUndefined();
    expect(action).not.toHaveBeenCalled();
    expect(saved).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledTimes(1);
    unregister();
  });

  it('does nothing for a suspended account', async () => {
    const navigate = vi.spyOn(browser, 'navigate').mockImplementation(() => {});
    await mountAs('suspended');
    const action = vi.fn();
    await expect(auth.run(action)).resolves.toBeUndefined();
    expect(action).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('signs in again when the session expired while the person was working', async () => {
    const navigate = vi.spyOn(browser, 'navigate').mockImplementation(() => {});
    const saved = vi.fn();
    const unregister = registerBeforeLogin(saved);
    await mountAs('user');
    const action = vi.fn().mockRejectedValue(unauthenticated());
    await expect(auth.run(action)).resolves.toBeUndefined();
    expect(saved).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(new URL(navigate.mock.calls[0]![0]).pathname).toBe('/lineup/auth/login');
    unregister();
  });

  it('re-throws any other error for the caller', async () => {
    const navigate = vi.spyOn(browser, 'navigate').mockImplementation(() => {});
    await mountAs('user');
    const failure = new ApiError({status: 409, kind: 'lineup', code: 'lineup_quota_exceeded'});
    await expect(auth.run(() => Promise.reject(failure))).rejects.toBe(failure);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('handleError signs in on a 401 only', async () => {
    const navigate = vi.spyOn(browser, 'navigate').mockImplementation(() => {});
    await mountAs('user');
    expect(auth.handleError(new Error('x'))).toBe(false);
    expect(auth.handleError(new ApiError({status: 404, kind: 'lineup', code: 'lineup_post_not_found'}))).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
    expect(auth.handleError(unauthenticated())).toBe(true);
    expect(navigate).toHaveBeenCalledTimes(1);
  });
});

describe('reauthentication (403 lineup_reauth_required)', () => {
  const reauthError = new ApiError({
    status: 403,
    kind: 'lineup',
    code: 'lineup_reauth_required',
    context: {login_url: '/lineup/auth/login'},
  });

  it('builds the Lineup sign-in URL from the API-relative login_url', () => {
    const url = new URL(reauthUrl(reauthError, 'https://lineup.moddy.app/me/experiences'));
    expect(url.pathname).toBe('/lineup/auth/login');
    expect(url.searchParams.get('redirect')).toBe('https://lineup.moddy.app/me/experiences');
  });

  it('does not follow a login_url that leaves the API', () => {
    const evil = new ApiError({
      status: 403,
      kind: 'lineup',
      code: 'lineup_reauth_required',
      context: {login_url: 'https://evil.example/x'},
    });
    expect(new URL(reauthUrl(evil, '/me')).host).not.toBe('evil.example');
  });

  it('says what it is for, then leaves for the sign-in after a moment, with drafts saved', async () => {
    const navigate = vi.spyOn(browser, 'navigate').mockImplementation(() => {});
    const saved = vi.fn();
    const unregister = registerBeforeLogin(saved);
    await mountAs('user');
    vi.useFakeTimers();

    act(() => reauthenticate(reauthError));
    expect(saved).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Autorisez Lineup à lire vos serveurs.')).toBeTruthy();
    expect(navigate).not.toHaveBeenCalled();

    act(() => void vi.advanceTimersByTime(REAUTH_DELAY_MS));
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(new URL(navigate.mock.calls[0]![0]).pathname).toBe('/lineup/auth/login');
    unregister();
  });
});
