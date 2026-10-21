import {act, fireEvent, screen, waitFor} from '@testing-library/react';
import {afterEach, beforeAll, describe, expect, it, vi} from 'vitest';

import {makeMe} from '@/api/fixtures';
import {useSession} from '@/auth/session';
import {browser} from '@/lib/browser';
import {json, mockApi, renderApp, useFrench} from '@/test/harness';

import {ReportButton, ReportDialog} from './ReportDialog';

/** Shows the session status, so that a test can wait until the session is known. */
function SessionProbe() {
  return <output data-testid="session">{useSession().status}</output>;
}
const sessionKnown = () => waitFor(() => expect(screen.getByTestId('session').textContent).not.toBe('loading'));

const POST_ID = '0b6f2c1e-3f0a-4c55-9d2a-6e9d1b0a7c11';

beforeAll(useFrench);
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const lineupError = (status: number, code: string, extra: Record<string, unknown> = {}, headers = {}) =>
  json(status, {error: {code, message: 'm', ...extra}, code, ...extra}, headers);

function mount({
  me = 'user',
  report,
  onClose = vi.fn(),
}: {
  me?: 'user' | 'anonymous' | 'suspended';
  report?: () => Response | Promise<Response>;
  onClose?: () => void;
} = {}) {
  const api = mockApi({
    'GET /lineup/me': () =>
      me === 'user'
        ? json(200, makeMe())
        : me === 'anonymous'
          ? json(401, {error: 'Non authentifie'})
          : json(403, {error: {code: 'user_suspended', references: [], message: 'm'}}),
    'POST /lineup/reports': report ?? (() => json(201, {id: 'r1', status: 'open', created: true})),
  });
  const app = renderApp([
    {
      index: true,
      element: (
        <>
          <SessionProbe />
          <ReportDialog open onClose={onClose} target={{type: 'post', id: POST_ID}} />
        </>
      ),
    },
  ]);
  return {...api, ...app, onClose};
}

const submit = () => document.querySelector('md-dialog md-filled-button') as HTMLElement;
const isDisabled = (element: HTMLElement) => element.hasAttribute('disabled');
const pick = (index: number) => fireEvent.change(document.querySelectorAll('md-radio')[index]!);
const type = (text: string) => {
  const field = document.querySelector('md-outlined-text-field') as HTMLElement & {value: string};
  field.value = text; // the stand-in element (Material Web is not loaded in jsdom) has no setter of its own
  fireEvent.input(field);
};
async function ready() {
  // The session is read before the form can send.
  await sessionKnown();
}

describe('ReportDialog', () => {
  it('asks for a reason among five, each with a one-line explanation, and a detail field of 1000 characters', async () => {
    mount();
    await ready();
    expect(screen.getByText('Signaler cette annonce')).toBeTruthy();
    for (const label of ['Spam', 'Arnaque', 'Contenu inapproprié', "Usurpation d'identité", 'Autre']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(screen.getByText("Demande d'argent ou de données personnelles.")).toBeTruthy();
    expect(document.querySelectorAll('md-radio')).toHaveLength(5);
    const field = document.querySelector('md-outlined-text-field')!;
    expect(field.getAttribute('maxlength')).toBe('1000');
    expect(field.getAttribute('rows')).toBe('3');
  });

  it('cannot be sent before a reason is chosen', async () => {
    const {calls} = mount();
    await ready();
    expect(isDisabled(submit())).toBe(true);
    fireEvent.click(submit());
    expect(calls.filter((call) => call.method === 'POST')).toHaveLength(0);
    pick(1);
    await waitFor(() => expect(isDisabled(submit())).toBe(false));
  });

  it('sends the target, the reason and the details, then closes and thanks calmly', async () => {
    const {calls, onClose} = mount();
    await ready();
    pick(1);
    type('  Demande de l’argent avant l’entretien.  ');
    await waitFor(() => expect(isDisabled(submit())).toBe(false));
    fireEvent.click(submit());

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    const post = calls.find((call) => call.method === 'POST')!;
    expect(post.path).toBe('/lineup/reports');
    expect(post.body).toEqual({
      target_type: 'post',
      target_id: POST_ID,
      reason: 'scam',
      details: 'Demande de l’argent avant l’entretien.',
    });
    expect(document.querySelector('.snackbar-message')!.textContent).toBe('Signalement envoyé. Merci.');
  });

  it('leaves the details out when empty', async () => {
    const {calls, onClose} = mount();
    await ready();
    pick(0);
    type('   ');
    await waitFor(() => expect(isDisabled(submit())).toBe(false));
    fireEvent.click(submit());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(calls.find((call) => call.method === 'POST')!.body).toEqual({
      target_type: 'post',
      target_id: POST_ID,
      reason: 'spam',
    });
  });

  it('takes "already reported" as a success, not an error, and stays open to say so', async () => {
    const {onClose} = mount({report: () => json(200, {id: 'r1', status: 'open', created: false})});
    await ready();
    pick(0);
    await waitFor(() => expect(isDisabled(submit())).toBe(false));
    fireEvent.click(submit());

    await screen.findByText("Vous avez déjà signalé ce contenu. L'équipe Moddy l'examine.");
    expect(screen.getByText('Déjà signalé')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(document.querySelector('md-dialog md-filled-button')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Fermer'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('says it is the own content of the person, and cannot be sent again', async () => {
    const {onClose} = mount({report: () => lineupError(422, 'lineup_report_self')});
    await ready();
    pick(0);
    await waitFor(() => expect(isDisabled(submit())).toBe(false));
    fireEvent.click(submit());

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Vous ne pouvez pas signaler votre propre contenu.',
    );
    expect(isDisabled(submit())).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('says the content is gone, and cannot be sent again', async () => {
    mount({report: () => lineupError(404, 'lineup_report_target_not_found')});
    await ready();
    pick(0);
    await waitFor(() => expect(isDisabled(submit())).toBe(false));
    fireEvent.click(submit());

    expect((await screen.findByRole('alert')).textContent).toContain("Ce contenu n'existe plus");
    expect(isDisabled(submit())).toBe(true);
  });

  it('disables sending for the wait the API gives, with the seconds left on the button', async () => {
    mount({report: () => lineupError(429, 'lineup_rate_limited', {retry_after: 30}, {'Retry-After': '30'})});
    await ready();
    pick(0);
    await waitFor(() => expect(isDisabled(submit())).toBe(false));
    vi.useFakeTimers({toFake: ['Date', 'setInterval', 'clearInterval']});
    fireEvent.click(submit());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByRole('alert').textContent).toContain('Réessayez dans 30 secondes');
    expect(isDisabled(submit())).toBe(true);
    expect(submit().textContent).toBe('Réessayer dans 30 s');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(submit().textContent).toBe('Réessayer dans 20 s');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    expect(isDisabled(submit())).toBe(false);
    expect(submit().textContent).toBe('Envoyer le signalement');
    expect(screen.getByRole('alert').textContent).toContain('Vous pouvez réessayer');
  });

  it('shows any other failure with its usual sentence, and lets the person try again', async () => {
    let attempts = 0;
    const {onClose} = mount({
      report: () => {
        if (++attempts === 1) throw new TypeError('Failed to fetch'); // no answer at all
        return json(201, {id: 'r', status: 'open', created: true});
      },
    });
    await ready();
    pick(0);
    await waitFor(() => expect(isDisabled(submit())).toBe(false));
    fireEvent.click(submit());
    expect((await screen.findByRole('alert')).textContent).toContain('Connexion impossible');
    await waitFor(() => expect(isDisabled(submit())).toBe(false));
    fireEvent.click(submit());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(attempts).toBe(2);
  });

  it('sends a signed-out visitor to sign in, without calling the API', async () => {
    const navigate = vi.spyOn(browser, 'navigate').mockImplementation(() => {});
    const {calls} = mount({me: 'anonymous'});
    await ready();
    pick(0);
    await waitFor(() => expect(isDisabled(submit())).toBe(false));
    fireEvent.click(submit());
    await waitFor(() => expect(navigate).toHaveBeenCalledTimes(1));
    expect(String(navigate.mock.calls[0]![0])).toContain('/lineup/auth/login');
    expect(calls.filter((call) => call.method === 'POST')).toHaveLength(0);
  });

  it('cannot be sent from a suspended account', async () => {
    mount({me: 'suspended'});
    await sessionKnown();
    pick(0);
    expect(isDisabled(submit())).toBe(true);
  });
});

describe('ReportButton', () => {
  const renderButton = (me: 'user' | 'anonymous' | 'suspended') => {
    mockApi({
      'GET /lineup/me': () =>
        me === 'user'
          ? json(200, makeMe())
          : me === 'anonymous'
            ? json(401, {error: 'Non authentifie'})
            : json(403, {error: {code: 'user_suspended', references: [], message: 'm'}}),
    });
    renderApp([
      {
        index: true,
        element: (
          <>
            <SessionProbe />
            <ReportButton target={{type: 'guild', id: '812345678901234567'}} />
          </>
        ),
      },
    ]);
    return sessionKnown();
  };

  it('opens the dialog for a signed-in person, with the flag icon', async () => {
    await renderButton('user');
    expect(document.querySelector('md-dialog')).toBeNull();
    expect(document.querySelector('md-text-button md-icon')!.textContent).toBe('flag');
    fireEvent.click(screen.getByText('Signaler'));
    await screen.findByText('Signaler ce serveur');
  });

  it('signs a visitor in instead of opening it', async () => {
    const navigate = vi.spyOn(browser, 'navigate').mockImplementation(() => {});
    await renderButton('anonymous');
    fireEvent.click(screen.getByText('Signaler'));
    await waitFor(() => expect(navigate).toHaveBeenCalledTimes(1));
    expect(document.querySelector('md-dialog')).toBeNull();
  });

  it('is disabled for a suspended account', async () => {
    await renderButton('suspended');
    await waitFor(() =>
      expect(screen.getByText('Signaler').closest('md-text-button')!.hasAttribute('disabled')).toBe(true),
    );
  });
});
