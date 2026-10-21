import {fireEvent, screen, within} from '@testing-library/react';
import {afterEach, beforeAll, describe, expect, it} from 'vitest';

import type {Badge} from '@/api/types';
import {i18n} from '@/i18n';
import {useFrench} from '@/test/harness';

import {BadgeStrip} from './BadgeStrip';
import {DisplayName} from './DisplayName';
import {InlineStats} from './InlineStats';
import {flagUrl} from './languageFlags';
import {LanguageFlags} from './LanguageFlags';
import {Markdown} from './Markdown';
import {renderWithCatalog} from './testUtils';
import {VerifiedBadge} from './VerifiedBadge';

beforeAll(useFrench);
afterEach(async () => {
  await i18n.changeLanguage('fr');
});

const badge = (id: string, source: Badge['source'] = 'computed'): Badge => ({
  id,
  label: {fr: `fr ${id}`, en: `en ${id}`},
  source,
});

describe('VerifiedBadge', () => {
  it('is an image named by its meaning, focusable, with an aria-hidden tooltip', () => {
    const {container} = renderWithCatalog(<VerifiedBadge kind="lineup_verified" entity="guild" />);
    const mark = screen.getByRole('img', {name: 'Serveur vérifié'});
    expect(mark.tabIndex).toBe(0);
    const tip = container.querySelector('.verified-badge-tip');
    expect(tip?.textContent).toBe('Serveur vérifié');
    expect(tip?.getAttribute('aria-hidden')).toBe('true');
    // The icon is the filled check_circle.
    expect(mark.querySelector('.material-symbols-outlined.filled')?.textContent).toBe('check_circle');
  });

  it('says "Compte vérifié" for a person and follows the language', async () => {
    renderWithCatalog(<VerifiedBadge kind="lineup_verified" entity="user" />);
    expect(screen.getByRole('img', {name: 'Compte vérifié'})).toBeTruthy();
    renderWithCatalog(<VerifiedBadge kind="moddy_staff" entity="user" />);
    expect(screen.getByRole('img', {name: 'Équipe Moddy'})).toBeTruthy();
    renderWithCatalog(<VerifiedBadge kind="moddy_server" entity="guild" />);
    expect(screen.getByRole('img', {name: 'Serveur officiel Moddy'})).toBeTruthy();
  });
});

describe('DisplayName', () => {
  it('shows the name without a mark when there is no badge', () => {
    const {container} = renderWithCatalog(<DisplayName name="Cubelands" entity="guild" />);
    expect(container.querySelector('.display-name-text')?.textContent).toBe('Cubelands');
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('adds the mark after the name, and renders as the requested element', () => {
    const {container} = renderWithCatalog(
      <DisplayName name="Noé" entity="user" as="h2" badges={[badge('moddy_staff')]} className="extra" />,
    );
    const heading = container.querySelector('h2.display-name.extra');
    expect(heading).not.toBeNull();
    const children = [...(heading?.children ?? [])];
    expect(children[0]?.className).toBe('display-name-text');
    expect(within(heading as HTMLElement).getByRole('img', {name: 'Équipe Moddy'})).toBeTruthy();
  });

  it('shows nothing extra when badges is missing', () => {
    renderWithCatalog(<DisplayName name="Camille" entity="user" badges={undefined} />);
    expect(screen.queryByRole('img')).toBeNull();
  });
});

describe('BadgeStrip', () => {
  it('leaves out Discord badges and the verification badges', () => {
    renderWithCatalog(
      <BadgeStrip
        badges={[
          badge('discord_verified', 'discord'),
          badge('discord_partner'),
          badge('moddy_staff'),
          badge('moddy_server', 'manual'),
          badge('lineup_verified', 'manual'),
          badge('moddy_installed'),
          badge('moddy_partner', 'manual'),
        ]}
      />,
    );
    const items = screen.getAllByRole('img');
    expect(items.map((item) => item.getAttribute('aria-label'))).toEqual(['Moddy installé', 'Partenaire Moddy']);
    expect(items[0]?.getAttribute('data-tooltip')).toBe('Moddy installé');
    expect(items[0]?.querySelector('.filled')?.textContent).toBe('smart_toy');
  });

  it('renders nothing when no badge qualifies', () => {
    const {container} = renderWithCatalog(
      <BadgeStrip badges={[badge('moddy_staff'), badge('discord_staff', 'discord')]} />,
    );
    expect(container.querySelector('.badge-strip')).toBeNull();
    const none = renderWithCatalog(<BadgeStrip badges={undefined} />);
    expect(none.container.querySelector('.badge-strip')).toBeNull();
  });

  it('uses the label of the badge when the catalog does not know it', () => {
    renderWithCatalog(<BadgeStrip badges={[badge('brand_new')]} />);
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe('fr brand_new');
  });
});

describe('LanguageFlags', () => {
  it('maps catalog languages to flags with the language name as tooltip', () => {
    renderWithCatalog(<LanguageFlags codes={['fr', 'en']} />);
    const flags = screen.getAllByRole('img');
    expect(flags.map((flag) => flag.getAttribute('aria-label'))).toEqual(['Français', 'Anglais']);
    expect(flags[0]?.getAttribute('data-tooltip')).toBe('Français');
    expect(flags[0]?.querySelector('img')?.getAttribute('src')).toBeTruthy();
  });

  it('shows a text pill for a language without a flag, and nothing for an empty list', () => {
    const {container} = renderWithCatalog(<LanguageFlags codes={['fr', 'xx']} />);
    expect(container.querySelector('.pill')?.textContent).toBe('xx');
    const empty = renderWithCatalog(<LanguageFlags codes={[]} />);
    expect(empty.container.querySelector('.language-flags')).toBeNull();
  });

  it('has a flag for every language of the catalog', async () => {
    const {catalogFixture} = await import('@/api/catalog.fixture');
    for (const entry of catalogFixture.languages) expect(flagUrl(entry.id), entry.id).toBeTruthy();
  });
});

describe('InlineStats', () => {
  it('formats numbers for the language and skips null values', () => {
    const {container} = renderWithCatalog(
      <InlineStats
        items={[
          {icon: 'circle', value: 18, label: 'en ligne'},
          {icon: 'group', value: 12345, label: 'membres'},
          {icon: 'bolt', value: null, label: 'boosts'},
          {icon: 'public', value: 'Europe', label: 'zone'},
        ]}
      />,
    );
    const items = [...container.querySelectorAll('.inline-stat')].map((item) => item.textContent?.replace(/\s/g, ' '));
    expect(items).toEqual(['circle18en ligne', 'group12 345membres', 'publicEuropezone']);
  });

  it('renders nothing without values', () => {
    const {container} = renderWithCatalog(<InlineStats items={[{icon: 'x', value: null, label: 'a'}]} />);
    expect(container.querySelector('.inline-stats')).toBeNull();
  });
});

describe('Markdown', () => {
  it('renders paragraphs, emphasis and lists', () => {
    const {container} = renderWithCatalog(<Markdown>{'Bonjour **vous**\n\n- un\n- deux'}</Markdown>);
    expect(container.querySelector('.markdown strong')?.textContent).toBe('vous');
    expect(container.querySelectorAll('.markdown li')).toHaveLength(2);
  });

  it('drops raw HTML, including scripts', () => {
    const {container} = renderWithCatalog(
      <Markdown>{'Salut <script>alert(1)</script><img src=x onerror=alert(1)> <b onclick="x()">gras</b>'}</Markdown>,
    );
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('b')).toBeNull();
    expect(container.innerHTML).not.toContain('onerror');
    expect(container.innerHTML).not.toContain('onclick');
  });

  it('opens http(s) and mailto links in a new tab with a safe rel', () => {
    const {container} = renderWithCatalog(
      <Markdown>{'[site](https://moddy.app) [mail](mailto:a@b.fr) <https://example.com>'}</Markdown>,
    );
    const links = [...container.querySelectorAll('a')];
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      'https://moddy.app',
      'mailto:a@b.fr',
      'https://example.com',
    ]);
    for (const link of links) {
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toBe('noopener noreferrer nofollow');
    }
  });

  it('keeps the text but not the link for javascript:, data: and relative URLs', () => {
    const {container} = renderWithCatalog(
      <Markdown>
        {'[a](javascript:alert(1)) [b](data:text/html;base64,AAAA) [c](/me) [d](JaVaScRiPt:alert(1))'}
      </Markdown>,
    );
    expect(container.querySelector('a')).toBeNull();
    expect(container.textContent).toContain('a b c d');
  });

  it('replaces images by their description', () => {
    const {container} = renderWithCatalog(<Markdown>{'![logo du serveur](https://x.test/a.png)'}</Markdown>);
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('logo du serveur');
  });

  it('brings every heading down: h1 to h3 become h3, h4 to h6 become h4', () => {
    const {container} = renderWithCatalog(<Markdown>{'# a\n## b\n### c\n#### d\n##### e\n###### f'}</Markdown>);
    expect([...container.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((heading) => heading.tagName)).toEqual([
      'H3',
      'H3',
      'H3',
      'H4',
      'H4',
      'H4',
    ]);
  });

  it('does not render tables or task boxes as such', () => {
    const {container} = renderWithCatalog(<Markdown>{'| a | b |\n|---|---|\n| 1 | 2 |\n\n- [x] fait'}</Markdown>);
    expect(container.querySelector('table')).toBeNull();
    expect(container.querySelector('input')).toBeNull();
    expect(container.textContent).toContain('fait');
  });

  it('adds the class passed', () => {
    const {container} = renderWithCatalog(<Markdown className="bio">{'x'}</Markdown>);
    expect(container.querySelector('.markdown.bio')).not.toBeNull();
    fireEvent.click(container);
  });
});
