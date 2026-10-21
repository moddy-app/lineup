import {screen, waitFor, within} from '@testing-library/react';
import {beforeAll, describe, expect, it} from 'vitest';

import {makeMe, makeMyGuild} from '@/api/fixtures';
import {json, mockApi, renderApp, useFrench} from '@/test/harness';

import {PageHeader, SettingsLayout, SettingsPanel, ShowcasePage} from './pageLayouts';

beforeAll(useFrench);

const settingsRoute = (path: string) => ({
  path,
  element: (
    <SettingsLayout
      title="Mes annonces"
      description="Gérez vos annonces."
      actions={<button type="button">Écrire</button>}
    >
      <SettingsPanel title="Panneau" description="Une phrase." actions={<button type="button">Enregistrer</button>}>
        <p>Contenu</p>
      </SettingsPanel>
    </SettingsLayout>
  ),
});

const guilds = () =>
  json(200, [
    makeMyGuild({id: '111', name: 'Atelier du Phénix', claimed: true}),
    makeMyGuild({id: '222', name: 'Pas encore revendiqué', claimed: false}),
  ]);

describe('SettingsLayout', () => {
  it('shows "Mon espace" with the four pages, the current one marked, then the content', async () => {
    mockApi({'GET /lineup/me': () => json(200, makeMe()), 'GET /lineup/me/guilds': guilds});
    renderApp([settingsRoute('me/posts')], {path: '/me/posts'});
    const nav = await screen.findByRole('navigation', {name: 'Mon espace'});
    const links = within(nav).getAllByRole('link');
    expect(links.map((link) => link.textContent?.replace(/^[a-z_]+/, ''))).toEqual([
      'Profil',
      'Expériences',
      'Annonces',
      'Serveurs',
    ]);
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/me',
      '/me/experiences',
      '/me/posts',
      '/me/guilds',
    ]);
    expect(links.map((link) => link.getAttribute('aria-current'))).toEqual([null, null, 'page', null]);
    expect(screen.getByRole('heading', {level: 1}).textContent).toBe('Mes annonces');
    expect(screen.getByRole('heading', {level: 2}).textContent).toBe('Panneau');
    expect(screen.getByText('Contenu')).toBeTruthy();
  });

  it('lists the claimed servers under "Serveurs gérés", linking to their management page', async () => {
    mockApi({'GET /lineup/me': () => json(200, makeMe()), 'GET /lineup/me/guilds': guilds});
    renderApp([settingsRoute('guilds/:guildId/manage')], {path: '/guilds/111/manage'});
    const managed = await screen.findByRole('navigation', {name: 'Serveurs gérés'});
    const links = within(managed).getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]?.getAttribute('href')).toBe('/guilds/111/manage');
    expect(links[0]?.getAttribute('aria-current')).toBe('page');
    expect(links[0]?.textContent).toContain('Atelier du Phénix');
    // On a management page, "Serveurs" (the list) is not the current page.
    const space = screen.getByRole('navigation', {name: 'Mon espace'});
    expect(
      within(space)
        .getAllByRole('link')
        .some((link) => link.getAttribute('aria-current') === 'page'),
    ).toBe(false);
  });

  it('renders without the managed list when the request fails', async () => {
    mockApi({
      'GET /lineup/me': () => json(200, makeMe()),
      'GET /lineup/me/guilds': () => json(502, {code: 'discord_unavailable', error: 'Discord indisponible'}),
    });
    renderApp([settingsRoute('me')], {path: '/me'});
    expect(await screen.findByText('Contenu')).toBeTruthy();
    await waitFor(() => expect(screen.getByRole('navigation', {name: 'Mon espace'})).toBeTruthy());
    expect(screen.queryByRole('navigation', {name: 'Serveurs gérés'})).toBeNull();
  });

  it('offers a compact button with the current section and a menu with the same entries', async () => {
    mockApi({'GET /lineup/me': () => json(200, makeMe()), 'GET /lineup/me/guilds': guilds});
    const {container} = renderApp([settingsRoute('me/posts')], {path: '/me/posts'});
    const compact = await waitFor(() => {
      const found = container.querySelector('.settings-compact-nav');
      expect(found).not.toBeNull();
      expect(found?.querySelectorAll('md-menu-item')).toHaveLength(5);
      return found as HTMLElement;
    });
    expect(compact.querySelector('.settings-compact-label')?.textContent).toBe('Mon espace · Annonces');
    const items = [...compact.querySelectorAll('md-menu-item')].map((item) =>
      item.textContent?.replace(/^[a-z_]+/, ''),
    );
    expect(items).toEqual(['Profil', 'Expériences', 'Annonces', 'Serveurs', 'Atelier du Phénix']);
    expect(compact.querySelectorAll('md-divider')).toHaveLength(1);
    expect(compact.querySelectorAll('md-menu-item[selected]')).toHaveLength(1);
  });

  it('marks the editor pages as part of "Annonces"', async () => {
    mockApi({'GET /lineup/me': () => json(200, makeMe()), 'GET /lineup/me/guilds': guilds});
    renderApp([settingsRoute('posts/:postId/edit')], {path: '/posts/abc/edit'});
    const nav = await screen.findByRole('navigation', {name: 'Mon espace'});
    expect(
      within(nav)
        .getByRole('link', {name: /Annonces/})
        .getAttribute('aria-current'),
    ).toBe('page');
  });
});

describe('SettingsPanel', () => {
  it('is a card with edge caps, a titled region and its actions last', async () => {
    mockApi({'GET /lineup/me': () => json(200, makeMe()), 'GET /lineup/me/guilds': guilds});
    renderApp([settingsRoute('me')], {path: '/me'});
    const region = await screen.findByRole('region', {name: 'Panneau'});
    expect(region.classList.contains('card')).toBe(true);
    expect(region.firstElementChild?.classList.contains('edge-caps')).toBe(true);
    expect(region.lastElementChild?.classList.contains('settings-panel-actions')).toBe(true);
  });
});

describe('ShowcasePage and PageHeader', () => {
  it('lays out leading, title, subtitle, meta and actions, with a single h1', async () => {
    mockApi({'GET /lineup/me': () => json(401, {error: 'Non authentifie'})});
    renderApp(
      [
        {
          path: 'x',
          element: (
            <ShowcasePage>
              <PageHeader
                leading={<span data-testid="lead" />}
                title="Cubelands"
                subtitle="Un serveur"
                meta={<span>meta</span>}
                actions={<button type="button">Agir</button>}
              />
            </ShowcasePage>
          ),
        },
      ],
      {path: '/x'},
    );
    const title = await screen.findByRole('heading', {level: 1});
    expect(title.textContent).toBe('Cubelands');
    const header = title.closest('header');
    expect(header?.querySelector('.page-header-leading [data-testid="lead"]')).not.toBeNull();
    expect(header?.querySelector('.page-header-subtitle')?.textContent).toBe('Un serveur');
    expect(header?.querySelector('.page-header-meta')?.textContent).toBe('meta');
    expect(header?.querySelector('.page-header-actions button')?.textContent).toBe('Agir');
    expect(document.querySelector('.page.showcase-page')).not.toBeNull();
    // No bento grid in a showcase page.
    expect(document.querySelector('.bento')).toBeNull();
  });
});
