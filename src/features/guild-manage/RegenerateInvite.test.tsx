import {fireEvent, screen, waitFor} from '@testing-library/react';
import {beforeAll, describe, expect, it, vi} from 'vitest';

import {makeGuildProfile, makeMe} from '@/api/fixtures';
import {json, mockApi, renderApp, useFrench} from '@/test/harness';

import {RegenerateInvite} from './RegenerateInvite';

beforeAll(useFrench);

const guild = makeGuildProfile({has_moddy: true, can_manage: true});
const button = () => document.querySelector('md-outlined-button') as HTMLElement;

function mount(put: () => Response, onManual = () => {}) {
  const api = mockApi({
    'GET /lineup/me': () => json(200, makeMe()),
    [`PUT /lineup/guilds/${guild.id}`]: put,
  });
  renderApp([{path: 'manage', element: <RegenerateInvite guild={guild} onManual={onManual} />}], {path: '/manage'});
  return api;
}

describe('regenerate invitation', () => {
  it('sends invite: null and confirms with a snackbar', async () => {
    const api = mount(() =>
      json(200, {...guild, invite: {code: 'nouveau', url: 'https://discord.gg/nouveau', valid: true}}),
    );
    await waitFor(() => expect(button().hasAttribute('disabled')).toBe(false));
    fireEvent.click(button());
    expect(await screen.findByText('Nouvelle invitation générée.')).toBeTruthy();
    const put = api.calls.find((call) => call.method === 'PUT');
    expect(put?.body).toEqual({invite: null});
  });

  it('shows invite_required on one line and opens the manual field', async () => {
    const onManual = vi.fn();
    mount(() => json(422, {error: {code: 'invite_required', message: 'm'}, code: 'invite_required'}), onManual);
    await waitFor(() => expect(button().hasAttribute('disabled')).toBe(false));
    fireEvent.click(button());
    expect(await screen.findByText(/Une invitation permanente est nécessaire/)).toBeTruthy();
    expect(onManual).toHaveBeenCalledTimes(1);
  });
});
