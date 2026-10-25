import {fireEvent, screen, waitFor} from '@testing-library/react';
import {afterEach, beforeAll, describe, expect, it, vi} from 'vitest';

import {makeGuildProfile, makeMe, makeMyGuild} from '@/api/fixtures';
import {json, mockApi, renderApp, useFrench} from '@/test/harness';

import {useServersDialog} from '@/ui';

import ServersDialogs from './ServersDialogs';

beforeAll(useFrench);
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.sessionStorage.clear();
});

const MODDY = makeMyGuild({id: '812345678901234567', name: 'Cubelands FR', has_moddy: true});
const PLAIN = makeMyGuild({id: '912345678901234567', name: 'Studio Nocturne', has_moddy: false});
const CLAIMED = makeMyGuild({id: '712345678901234567', name: 'Pixel Forge', claimed: true, listed: false});

const lineupError = (status: number, code: string) => json(status, {error: {code, message: 'm'}, code});

function Page() {
  const {mode, show} = useServersDialog();
  return <ServersDialogs mode={mode} show={show} />;
}

function mount(claim: () => Response | Promise<Response>, mode: 'add' | 'manage' = 'add') {
  const api = mockApi({
    'GET /lineup/me': () => json(200, makeMe()),
    'GET /lineup/me/guilds': () => json(200, [CLAIMED, MODDY, PLAIN]),
    'POST /lineup/guilds/claim': claim,
  });
  renderApp(
    [
      {path: 'me', element: <Page />},
      {path: 'guilds/:id/manage', element: <p>Gestion</p>},
    ],
    {path: `/me?servers=${mode}`},
  );
  return api;
}

const claimCalls = (api: ReturnType<typeof mockApi>) =>
  api.calls.filter((call) => call.method === 'POST' && call.path === '/lineup/guilds/claim');
const dialogButton = () => document.querySelector('md-dialog md-filled-button') as HTMLElement;
const fieldError = () => {
  return inviteField()?.getAttribute('errortext') ?? '';
};
// The open dialog's field (the bot dialogs stay mounted, closed, next to it).
const inviteField = () => document.querySelector('md-dialog[open] md-outlined-text-field');

async function openFor(name: string) {
  const row = (await screen.findByText(name)).closest('li') as HTMLElement;
  fireEvent.click(row.querySelector('md-outlined-button') as HTMLElement);
}

const textButton = (label: string) =>
  [...document.querySelectorAll<HTMLElement>('md-dialog md-text-button')].find((b) => b.textContent === label);

describe('server dialogs', () => {
  it('manage: reads "in the directory" or "hidden" from the list itself, with one request for all the servers', async () => {
    const api = mount(() => json(201, makeGuildProfile()), 'manage');
    expect(await screen.findByText('Masqué')).toBeTruthy();
    expect(screen.getAllByText('Gérer les serveurs').length).toBeGreaterThan(0);
    expect(api.calls.some((call) => call.path.startsWith('/lineup/guilds/'))).toBe(false);
  });

  it('lists only the servers not on Lineup yet, and goes back to the list from a step', async () => {
    mount(() => json(201, makeGuildProfile()));
    expect(await screen.findByText('Cubelands FR')).toBeTruthy();
    await openFor('Studio Nocturne');
    expect(inviteField()).not.toBeNull();
    fireEvent.click(textButton('Retour à la liste')!);
    expect(await screen.findByText('Cubelands FR')).toBeTruthy();
    expect(inviteField()).toBeNull();
  });

  it('adds a server where Moddy is with its id alone: no invitation field', async () => {
    const api = mount(() => json(201, makeGuildProfile({id: MODDY.id})));
    await openFor('Cubelands FR');
    expect(await screen.findByText(/Moddy est déjà sur Cubelands FR/)).toBeTruthy();
    expect(inviteField()).toBeNull();
    fireEvent.click(dialogButton());
    await waitFor(() => expect(claimCalls(api)).toHaveLength(1));
    expect(claimCalls(api)[0]!.body).toEqual({guild_id: MODDY.id});
    // The profile is created: on to its management page.
    expect(await screen.findByText('Gestion')).toBeTruthy();
  });

  it('asks for an invitation without Moddy, and sends it with the server id', async () => {
    const api = mount(() => json(201, makeGuildProfile({id: PLAIN.id})));
    await openFor('Studio Nocturne');
    expect(inviteField()).not.toBeNull();
    const field = inviteField() as HTMLElement & {value: string};
    expect(dialogButton().hasAttribute('disabled')).toBe(true);
    field.value = 'studio-nocturne';
    fireEvent.input(field);
    fireEvent.click(dialogButton());
    await waitFor(() => expect(claimCalls(api)).toHaveLength(1));
    expect(claimCalls(api)[0]!.body).toEqual({invite: 'studio-nocturne', guild_id: PLAIN.id});
  });

  it('falls back to the invitation field when the API says Moddy is no longer there (invite_required)', async () => {
    const api = mount(() => lineupError(422, 'invite_required'));
    await openFor('Cubelands FR');
    fireEvent.click(dialogButton());
    await waitFor(() => expect(inviteField()).not.toBeNull());
    expect(fieldError()).toMatch(/Moddy n'est pas sur ce serveur/);
    expect(claimCalls(api)[0]!.body).toEqual({guild_id: MODDY.id});
  });

  it('shows invite_guild_mismatch on the invitation field', async () => {
    mount(() => lineupError(422, 'invite_guild_mismatch'));
    await openFor('Studio Nocturne');
    const field = inviteField() as HTMLElement & {value: string};
    field.value = 'cubelands';
    fireEvent.input(field);
    fireEvent.click(dialogButton());
    await waitFor(() => expect(fieldError()).toBe('Cette invitation mène à un autre serveur.'));
  });
});
