import {render, screen} from '@testing-library/react';
import {createMemoryRouter, type RouteObject, RouterProvider} from 'react-router';
import {describe, expect, it} from 'vitest';

import {paths, routePatterns} from './paths';
import {routes} from './routes';

describe('paths', () => {
  it('has the talent page, "my servers", and keeps the old claim path leading to it', () => {
    expect(paths.people()).toBe('/people');
    expect(paths.myGuilds()).toBe('/me/guilds');
    expect(paths.guildClaim()).toBe('/me/guilds');
    expect(routePatterns.people).toBe('/people');
    expect(routePatterns.myGuilds).toBe('/me/guilds');
    // The old address is still a route pattern, for the redirect.
    expect(routePatterns.guildClaim).toBe('/guilds/claim');
  });

  it('encodes ids', () => {
    expect(paths.user('a/b')).toBe('/users/a%2Fb');
    expect(paths.guildManage('1 2')).toBe('/guilds/1%202/manage');
  });
});

describe('routes', () => {
  const router = (path: string) => createMemoryRouter(routes, {initialEntries: [path]});

  it('redirects /guilds/claim to /me/guilds, replacing the history entry', () => {
    const find = (list: RouteObject[]): RouteObject | undefined => {
      for (const route of list) {
        if (route.path === routePatterns.guildClaim) return route;
        const inner = route.children && find(route.children);
        if (inner) return inner;
      }
      return undefined;
    };
    const route = find(routes);
    expect(route?.element).toBeTruthy();
    const r = createMemoryRouter(
      [
        {path: routePatterns.guildClaim, element: route?.element},
        {path: routePatterns.myGuilds, element: <p>Mes serveurs</p>},
      ],
      {initialEntries: ['/', '/guilds/claim'], initialIndex: 1},
    );
    render(<RouterProvider router={r} />);
    expect(screen.getByText('Mes serveurs')).toBeTruthy();
    expect(r.state.location.pathname).toBe('/me/guilds');
    // Replaced: going back leaves the app's previous page, not the old address.
    expect(r.state.historyAction).toBe('REPLACE');
  });

  it('matches /people, /me/guilds and still /guilds/:guildId', () => {
    const matched = (path: string) => {
      const r = router(path);
      return r.state.matches.map((match) => match.route.path).filter(Boolean);
    };
    expect(matched('/people')).toContain(routePatterns.people);
    expect(matched('/me/guilds')).toContain(routePatterns.myGuilds);
    expect(matched('/guilds/123')).toContain(routePatterns.guild);
    expect(matched('/guilds/claim')).toContain(routePatterns.guildClaim);
  });
});
