import {screen, within} from '@testing-library/react';
import {beforeAll, describe, expect, it} from 'vitest';

import {catalogFixture} from '@/api/catalog.fixture';
import {makeGuildProfile, makeMe} from '@/api/fixtures';
import type {Badge} from '@/api/types';
import {json, mockApi, renderApp, useFrench} from '@/test/harness';

import {Component} from './GuildProfilePage';

beforeAll(useFrench);

const verified: Badge = {
  id: 'lineup_verified',
  label: {fr: 'Serveur vérifié', en: 'Verified server'},
  source: 'computed',
};

function setup(overrides: Parameters<typeof makeGuildProfile>[0] = {}) {
  const guild = makeGuildProfile(overrides);
  mockApi({
    'GET /lineup/me': () => json(200, makeMe()),
    'GET /lineup/catalog': () => json(200, catalogFixture),
    [`GET /lineup/guilds/${guild.id}`]: () => json(200, guild),
  });
  renderApp([{path: 'guilds/:guildId', Component}], {path: `/guilds/${guild.id}`});
  return guild;
}

describe('guild profile', () => {
  it('puts the name, its mark and the figures in the header, without a big stat', async () => {
    setup({badges: [verified], can_manage: false, description: 'Un **gras** et [un lien](https://example.com)'});
    const title = await screen.findByRole('heading', {level: 1});
    expect(title.textContent).toContain('Cubelands FR');
    expect(within(title).getByRole('img', {name: 'Vérifié'})).toBeTruthy();
    expect(screen.getByText('4 120')).toBeTruthy();
    expect(screen.queryByText('640')).toBeNull();
    // The description is Markdown.
    expect(screen.getByText('gras').tagName).toBe('STRONG');
    expect(screen.getByRole('link', {name: 'un lien'}).getAttribute('href')).toBe('https://example.com');
  });

  it('shows the join button only with a valid invite, and the manage link only to managers', async () => {
    setup({can_manage: true});
    expect(await screen.findByRole('heading', {level: 1})).toBeTruthy();
    expect(document.querySelector('md-filled-button')?.getAttribute('href')).toBe('https://discord.gg/cubelands');
    expect(document.querySelector('md-outlined-button')?.getAttribute('href')).toBe(
      '/guilds/812345678901234567/manage',
    );
  });

  it('has no join button when the bot could create no invitation (url null)', async () => {
    setup({invite: {code: '', url: null, valid: true}, can_manage: false});
    await screen.findByRole('heading', {level: 1});
    expect(document.querySelector('md-filled-button')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('has no join button when the invite is lost, and tells managers in one line', async () => {
    setup({invite: {code: 'x', url: 'https://discord.gg/x', valid: false}, listed: false});
    await screen.findByRole('heading', {level: 1});
    expect(document.querySelector('md-filled-button')).toBeNull();
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.getByText(/Ce profil est masqué/)).toBeTruthy();
    expect(screen.getByText(/n'existe plus/)).toBeTruthy();
  });

  it('draws a banner only when the server has one', async () => {
    setup({banner_url: 'https://cdn.test/banner.png'});
    await screen.findByRole('heading', {level: 1});
    expect(document.querySelector('img.guild-banner')?.getAttribute('src')).toBe('https://cdn.test/banner.png');
  });
});
