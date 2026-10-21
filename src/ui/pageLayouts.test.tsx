import {fireEvent, screen, waitFor, within} from '@testing-library/react';
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
  const settle = (path: string, route = path) => {
    mockApi({'GET /lineup/me': () => json(200, makeMe()), 'GET /lineup/me/guilds': guilds});
    return renderApp([settingsRoute(route)], {path: `/${path}`});
  };

  it('shows the personal pages (no "Serveurs"), the current one marked, then the content', async () => {
    settle('me/posts');
    const nav = await screen.findByRole('navigation', {name: 'Pages du tableau de bord'});
    const links = within(nav).getAllByRole('link');
    expect(links.map((link) => link.textContent?.replace(/^[a-z_]+/, ''))).toEqual([
      'Profil',
      'Expériences',
      'Annonces',
    ]);
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/me', '/me/experiences', '/me/posts']);
    expect(links.map((link) => link.getAttribute('aria-current'))).toEqual([null, null, 'page']);
    expect(screen.getByRole('heading', {level: 1}).textContent).toBe('Mes annonces');
    expect(screen.getByRole('heading', {level: 2}).textContent).toBe('Panneau');
    expect(screen.getByText('Contenu')).toBeTruthy();
  });

  it('shows the pages of a server under /guilds/:id/manage', async () => {
    settle('guilds/111/manage/posts', 'guilds/:guildId/manage/posts');
    const nav = await screen.findByRole('navigation', {name: 'Pages du tableau de bord'});
    const links = within(nav).getAllByRole('link');
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/guilds/111/manage',
      '/guilds/111/manage/invite',
      '/guilds/111/manage/posts',
      '/guilds/111/manage/discord',
      '/guilds/111/manage/settings',
    ]);
    expect(links.map((link) => link.getAttribute('aria-current'))).toEqual([null, null, 'page', null, null]);
  });

  it('marks no page as current on "Gérer mes serveurs"', async () => {
    settle('me/guilds');
    const nav = await screen.findByRole('navigation', {name: 'Pages du tableau de bord'});
    expect(
      within(nav)
        .getAllByRole('link')
        .some((link) => link.hasAttribute('aria-current')),
    ).toBe(false);
  });

  it('offers a selector: you, the claimed servers, then "Gérer mes serveurs"', async () => {
    const {container} = settle('me/posts');
    const button = await waitFor(() => {
      const found = container.querySelector<HTMLElement>('.settings-context md-outlined-button');
      expect(found).not.toBeNull();
      return found!;
    });
    await waitFor(() => expect(button.textContent).toContain('Alex'));
    fireEvent.click(button);
    const menu = await screen.findByRole('menu', {name: 'Gérer'});
    const items = [...menu.querySelectorAll<HTMLElement>('[role^="menuitem"]')];
    expect(items.map((item) => item.textContent?.replace(/^[a-z_]+/, '').replace(/check$/, ''))).toEqual([
      expect.stringContaining('Alex'),
      'Atelier du Phénix',
      'Gérer mes serveurs',
    ]);
    expect(items[0]?.getAttribute('aria-checked')).toBe('true');
  });

  it('shows the server of the address in the selector', async () => {
    const {container} = settle('guilds/111/manage', 'guilds/:guildId/manage');
    await waitFor(() =>
      expect(container.querySelector('.settings-context-name')?.textContent).toBe('Atelier du Phénix'),
    );
  });

  it('keeps only you when the list of servers fails', async () => {
    mockApi({
      'GET /lineup/me': () => json(200, makeMe()),
      'GET /lineup/me/guilds': () => json(502, {code: 'discord_unavailable', error: 'Discord indisponible'}),
    });
    const {container} = renderApp([settingsRoute('me')], {path: '/me'});
    expect(await screen.findByText('Contenu')).toBeTruthy();
    fireEvent.click(container.querySelector<HTMLElement>('.settings-context md-outlined-button')!);
    const menu = await screen.findByRole('menu', {name: 'Gérer'});
    expect([...menu.querySelectorAll<HTMLElement>('[role^="menuitem"]')]).toHaveLength(2);
  });

  it('offers a compact button with the current page and a menu with the same entries', async () => {
    const {container} = settle('me/posts');
    const compact = await waitFor(() => {
      const found = container.querySelector<HTMLElement>('.settings-compact-nav');
      expect(found).not.toBeNull();
      return found!;
    });
    expect(compact.querySelector('.settings-compact-label')?.textContent).toBe('Annonces');
    fireEvent.click(compact.querySelector<HTMLElement>('md-outlined-button')!);
    const menu = await screen.findByRole('menu', {name: 'Annonces'});
    const items = [...menu.querySelectorAll<HTMLElement>('[role^="menuitem"]')];
    expect(items.map((item) => item.textContent?.replace(/^[a-z_]+/, '').replace(/check$/, ''))).toEqual([
      'Profil',
      'Expériences',
      'Annonces',
    ]);
    expect(items.map((item) => item.getAttribute('aria-checked'))).toEqual(['false', 'false', 'true']);
  });

  it('marks the editor pages as part of "Annonces"', async () => {
    settle('posts/abc/edit', 'posts/:postId/edit');
    const nav = await screen.findByRole('navigation', {name: 'Pages du tableau de bord'});
    expect(
      within(nav)
        .getByRole('link', {name: /Annonces/})
        .getAttribute('aria-current'),
    ).toBe('page');
  });

  it('takes the context from a prop when the address does not say it', async () => {
    mockApi({'GET /lineup/me': () => json(200, makeMe()), 'GET /lineup/me/guilds': guilds});
    renderApp(
      [
        {
          path: 'posts/:postId/edit',
          element: (
            <SettingsLayout title="Éditeur" context={{kind: 'guild', guildId: '111'}}>
              x
            </SettingsLayout>
          ),
        },
      ],
      {path: '/posts/abc/edit'},
    );
    const nav = await screen.findByRole('navigation', {name: 'Pages du tableau de bord'});
    expect(within(nav).getAllByRole('link')).toHaveLength(5);
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
