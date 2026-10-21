import {act, fireEvent, screen, within} from '@testing-library/react';
import {afterEach, beforeAll, beforeEach, describe, expect, it, vi} from 'vitest';

import {ApiError} from '@/api/client';
import {makeExperience, makePost} from '@/api/fixtures';
import type {Badge} from '@/api/types';
import {i18n} from '@/i18n';
import {useFrench} from '@/test/harness';

import {ApplicationAction} from './ApplicationAction';
import {BadgeList} from './BadgeList';
import {CommitmentSummary} from './CommitmentSummary';
import {EmptyState} from './EmptyState';
import {ErrorState} from './ErrorState';
import {ExperienceRow} from './ExperienceRow';
import {GuildIcon} from './GuildIcon';
import {LanguageList} from './LanguageList';
import {LinkList} from './LinkList';
import {PostCard} from './PostCard';
import {QuotaMeter} from './QuotaMeter';
import {RelativeTime} from './RelativeTime';
import {RequirementList} from './RequirementList';
import {contentOf, renderWithCatalog} from './testUtils';
import {TimezoneLabel} from './TimezoneLabel';
import {UserAvatar} from './UserAvatar';
import {Rows} from '@/ui';

beforeAll(useFrench);
afterEach(() => {
  vi.useRealTimers();
});

const badge = (id: string, source: Badge['source'] = 'computed'): Badge => ({
  id,
  label: {fr: `fr ${id}`, en: `en ${id}`},
  source,
});

describe('UserAvatar', () => {
  it('shows the picture, with an empty alt (the name sits next to it)', () => {
    const {container} = renderWithCatalog(<UserAvatar id="345678901234567890" src="https://cdn.test/a.png" />);
    const image = container.querySelector('img.avatar') as HTMLImageElement;
    expect(image.getAttribute('src')).toBe('https://cdn.test/a.png');
    expect(image.getAttribute('alt')).toBe('');
    expect(container.querySelector('.avatar-decoration')).toBeNull();
    expect(container.querySelector('.user-avatar')).toBeNull();
  });

  it("uses Discord's default avatar for the id when there is no picture", () => {
    const {container} = renderWithCatalog(<UserAvatar id="345678901234567890" />);
    expect(container.querySelector('img')!.getAttribute('src')).toMatch(
      /^https:\/\/cdn\.discordapp\.com\/embed\/avatars\/[0-5]\.png$/,
    );
  });

  it('falls back to the default avatar when the picture fails, and survives an id that is not a number', () => {
    const {container} = renderWithCatalog(<UserAvatar id="not-an-id" src="https://cdn.test/gone.png" />);
    fireEvent.error(container.querySelector('img')!);
    expect(container.querySelector('img')!.getAttribute('src')).toBe('https://cdn.discordapp.com/embed/avatars/0.png');
  });

  it('draws the decoration over the picture, hidden from assistive tech, only when it has a url', () => {
    const {container, rerender} = renderWithCatalog(
      <UserAvatar id="1" src="https://cdn.test/a.png" size="large" decoration={{url: 'https://cdn.test/deco.png'}} />,
    );
    const wrapper = container.querySelector('.user-avatar') as HTMLElement;
    expect(wrapper.className).toContain('large');
    const overlay = wrapper.querySelector('img.avatar-decoration') as HTMLImageElement;
    expect(overlay.getAttribute('src')).toBe('https://cdn.test/deco.png');
    expect(overlay.getAttribute('aria-hidden')).toBe('true');
    expect(overlay.getAttribute('alt')).toBe('');
    expect(wrapper.querySelectorAll('img')).toHaveLength(2);
    rerender(<UserAvatar id="1" decoration={{url: ''}} />);
    expect(container.querySelector('.avatar-decoration')).toBeNull();
  });
});

describe('GuildIcon', () => {
  it('shows the server icon', () => {
    const {container} = renderWithCatalog(
      <GuildIcon id="812345678901234567" iconUrl="https://cdn.test/i.png" size="large" />,
    );
    const image = container.querySelector('img.guild-icon') as HTMLImageElement;
    expect(image.getAttribute('src')).toBe('https://cdn.test/i.png');
    expect(image.className).toContain('is-large');
  });

  it('shows a square shape with a groups symbol when there is no icon, its tone fixed by the id', () => {
    const {container} = renderWithCatalog(
      <>
        <GuildIcon id="3" />
        <GuildIcon id="4" />
        <GuildIcon id="5" />
        <GuildIcon id="3" iconUrl={null} icon="apartment" />
      </>,
    );
    const shapes = [...container.querySelectorAll('.shape.guild-icon')];
    expect(shapes.map((shape) => shape.className.includes('shape-square'))).toEqual([true, true, true, true]);
    expect(shapes[0]!.className).not.toContain('tone-');
    expect(shapes[1]!.className).toContain('tone-secondary');
    expect(shapes[2]!.className).toContain('tone-tertiary');
    expect(shapes[0]!.textContent).toBe('groups');
    expect(shapes[3]!.textContent).toBe('apartment');
  });

  it('falls back to the shape when the image fails to load', () => {
    const {container} = renderWithCatalog(<GuildIcon id="3" iconUrl="https://cdn.test/gone.png" />);
    fireEvent.error(container.querySelector('img')!);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('.shape.guild-icon')).not.toBeNull();
  });
});

describe('BadgeList', () => {
  it('shows icon and name, in the given order', () => {
    const {container} = renderWithCatalog(
      <BadgeList badges={[badge('discord_verified'), badge('moddy_installed'), badge('lineup_verified', 'manual')]} />,
    );
    const items = [...container.querySelectorAll('.badge-item')];
    expect(items.map((item) => item.textContent)).toEqual([
      'verifiedServeur vérifié Discord',
      'smart_toyModdy installé',
      'verified_userVérifié par Lineup',
    ]);
    expect(items[2]!.className).toContain('manual');
    expect(items[0]!.className).not.toContain('manual');
  });

  it('labels from the catalog, then from the badge, then the id', () => {
    renderWithCatalog(<BadgeList badges={[badge('moddy_staff'), badge('future_badge')]} />);
    expect(screen.getByText('Équipe Moddy')).toBeTruthy();
    expect(screen.getByText('fr future_badge')).toBeTruthy();
  });

  it('uses the generic icon for an unknown badge', () => {
    const {container} = renderWithCatalog(<BadgeList badges={[badge('future_badge')]} />);
    expect(container.querySelector('.badge-item .material-symbols-outlined')!.textContent).toBe('workspace_premium');
  });

  it('renders nothing without badges', () => {
    const {container} = renderWithCatalog(<BadgeList badges={[]} />);
    expect(container.querySelector('.badge-list')).toBeNull();
  });

  it('is icon only in compact, with the name in a focusable tooltip', () => {
    renderWithCatalog(<BadgeList badges={[badge('moddy_staff')]} variant="compact" />);
    const item = screen.getByRole('img', {name: 'Équipe Moddy'});
    expect(item.getAttribute('data-tooltip')).toBe('Équipe Moddy');
    expect(item.getAttribute('tabindex')).toBe('0');
    expect(item.textContent).toBe('shield_person');
  });

  it('can leave the compact icons out of the tab order, inside a link card', () => {
    renderWithCatalog(<BadgeList badges={[badge('moddy_staff')]} variant="compact" focusable={false} />);
    expect(screen.getByRole('img', {name: 'Équipe Moddy'}).hasAttribute('tabindex')).toBe(false);
  });

  it('keeps `max` badges and lists the rest in a "+n" tooltip', () => {
    const badges = [
      badge('discord_verified'),
      badge('moddy_installed'),
      badge('nsfw'),
      badge('moddy_partner', 'manual'),
    ];
    renderWithCatalog(<BadgeList badges={badges} variant="compact" max={2} />);
    expect(screen.getAllByRole('img')).toHaveLength(3);
    const more = screen.getByText('+2');
    expect(more.getAttribute('data-tooltip')).toBe('NSFW (18+)\nPartenaire Moddy');
    expect(more.getAttribute('aria-label')).toBe('2 autres badges : NSFW (18+), Partenaire Moddy');
  });

  it('shows no "+n" when everything fits', () => {
    renderWithCatalog(<BadgeList badges={[badge('nsfw')]} max={3} />);
    expect(screen.queryByText(/^\+/)).toBeNull();
  });
});

describe('PostCard, feed variant', () => {
  const guildPost = makePost({
    id: '0b6f2c1e-3f0a-4c55-9d2a-6e9d1b0a7c11',
    title: 'Cherche 2 modérateurs',
    description: 'Une **communauté** de [4 000](https://x.y) membres.\n\nSoirée.',
    positions: ['moderator', 'other'],
    positions_other: ['Gestionnaire de bots'],
    languages: ['fr', 'en', 'es', 'de'],
    commitment: {hours_per_week: 5, compensation: 'volunteer', openings: 2},
    expires_at: new Date(Date.now() + 5 * 86_400_000 - 2 * 3_600_000).toISOString(),
    guild: {id: '812345678901234567', name: 'Cubelands FR', icon_url: null},
  });

  it('is one link to the post, with nothing interactive inside', () => {
    const {container} = renderWithCatalog(<PostCard post={guildPost} />);
    const link = container.querySelector('a.card') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/posts/0b6f2c1e-3f0a-4c55-9d2a-6e9d1b0a7c11');
    expect(container.querySelectorAll('a')).toHaveLength(1);
    expect(
      link.querySelectorAll('button, a, input, select, textarea, [tabindex], md-text-button, md-filled-button'),
    ).toHaveLength(0);
  });

  it('shows the server, the time, the kind, the title and a plain excerpt', () => {
    const {container} = renderWithCatalog(<PostCard post={guildPost} />);
    expect(screen.getByText('Cubelands FR')).toBeTruthy();
    expect(screen.getByText('Recrute')).toBeTruthy();
    expect(screen.getByRole('heading', {level: 2}).textContent).toBe('Cherche 2 modérateurs');
    expect(container.querySelector('.post-excerpt')!.textContent).toBe('Une communauté de 4 000 membres. Soirée.');
    const time = container.querySelector('time') as HTMLTimeElement;
    expect(time.getAttribute('datetime')).toBe(new Date(guildPost.published_at!).toISOString());
    expect(time.getAttribute('title')).toBeTruthy();
    expect(container.querySelector('.guild-icon')).not.toBeNull();
  });

  it('lists positions as chips, the author words in place of "other"', () => {
    const {container} = renderWithCatalog(<PostCard post={guildPost} />);
    const chips = [...container.querySelectorAll('.chips .chip')].map((chip) => chip.textContent);
    expect(chips).toEqual(['shield_personModérateur', 'workGestionnaire de bots']);
  });

  it('gives compensation, hours, openings, three languages and the near expiry on one line', () => {
    const {container} = renderWithCatalog(<PostCard post={guildPost} />);
    const meta = [...container.querySelectorAll('.meta-list .meta-item')].map((item) => item.textContent);
    expect(meta).toEqual([
      'paymentsBénévole',
      'schedule5 h par semaine',
      'group_add2 postes ouverts',
      'translateFrançais, Anglais, Espagnol +1',
      'hourglass_bottomExpire dans 5 jours',
    ]);
  });

  it('says nothing about a far expiry, and has no meta line when there is nothing to say', () => {
    const post = makePost({
      languages: [],
      commitment: null,
      expires_at: new Date(Date.now() + 60 * 86_400_000).toISOString(),
    });
    const {container} = renderWithCatalog(<PostCard post={post} />);
    expect(container.querySelector('.meta-list')).toBeNull();
  });

  it('says expired for an expired post', () => {
    const {container} = renderWithCatalog(
      <PostCard post={makePost({is_expired: true, expires_at: '2026-01-01T00:00:00Z'})} />,
    );
    expect(container.querySelector('.meta-item.expiry-near')!.textContent).toContain('Expirée');
  });

  it('shows the person for a user post, with the other kind marker', () => {
    const post = makePost({
      kind: 'user',
      guild_id: null,
      guild: null,
      author: {
        id: '345678901234567890',
        username: 'alex',
        global_name: 'Alex Martin',
        avatar_url: 'https://cdn.test/a.png',
      },
    });
    const {container} = renderWithCatalog(<PostCard post={post} />);
    expect(screen.getByText('Alex Martin')).toBeTruthy();
    expect(screen.getByText('Cherche une équipe')).toBeTruthy();
    expect(container.querySelector('img.avatar')!.getAttribute('src')).toBe('https://cdn.test/a.png');
    expect(container.querySelector('.guild-icon')).toBeNull();
  });

  it('copes with unknown names', () => {
    renderWithCatalog(<PostCard post={makePost({guild: {id: '812345678901234567', name: null, icon_url: null}})} />);
    expect(screen.getByText('Serveur sans nom')).toBeTruthy();
  });

  it('adds the status pill on request', () => {
    renderWithCatalog(<PostCard post={makePost({status: 'draft'})} showStatus />);
    expect(screen.getByText('Brouillon')).toBeTruthy();
  });
});

describe('PostCard, row variant', () => {
  it('is a link row with the title, positions, date and status', () => {
    const post = makePost({id: 'p1', title: 'Cherche un admin', positions: ['admin'], status: 'closed'});
    const {container} = renderWithCatalog(
      <Rows as="ul">
        <PostCard post={post} variant="row" showStatus />
      </Rows>,
    );
    const link = container.querySelector('li > a.row') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/posts/p1');
    expect(within(link).getByText('Cherche un admin')).toBeTruthy();
    expect(link.querySelector('.row-meta')!.textContent).toContain('Administrateur · ');
    const status = within(link).getByText('Fermée');
    expect(status.className).toContain('neutral');
  });

  it('shows "Expirée" in place of "Publiée" for an expired published post', () => {
    renderWithCatalog(
      <Rows as="ul">
        <PostCard post={makePost({status: 'published', is_expired: true})} variant="row" showStatus />
      </Rows>,
    );
    expect(screen.getByText('Expirée')).toBeTruthy();
    expect(screen.queryByText('Publiée')).toBeNull();
  });

  it('hides the status unless asked', () => {
    renderWithCatalog(
      <Rows as="ul">
        <PostCard post={makePost({status: 'draft'})} variant="row" />
      </Rows>,
    );
    expect(screen.queryByText('Brouillon')).toBeNull();
  });
});

describe('RequirementList', () => {
  const requirements = [
    {type: 'min_age', value: 16, label: null, verified_by_lineup: false},
    {type: 'account_age_days', value: 180, label: null, verified_by_lineup: true},
    {type: 'custom', value: 'Savoir utiliser Moddy', label: 'Outils', verified_by_lineup: false},
    {type: 'voice_required', value: true, label: null, verified_by_lineup: false},
  ];

  it('writes each condition as a name and its value', () => {
    const {container} = renderWithCatalog(<RequirementList requirements={requirements} />);
    const rows = [...container.querySelectorAll('li.requirement')];
    expect(rows).toHaveLength(4);
    expect(rows[0]!.querySelector('.row-title')!.textContent).toBe('Âge minimum');
    expect(rows[0]!.querySelector('.row-meta')!.textContent).toBe('16 ans minimum');
    expect(rows[1]!.querySelector('.row-title')!.textContent).toBe('Ancienneté du compte Discord');
    expect(rows[1]!.querySelector('.row-meta')!.textContent).toBe('180 jours, environ 6 mois');
    expect(rows[2]!.querySelector('.row-title')!.textContent).toBe('Outils');
    expect(rows[2]!.querySelector('.row-meta')!.textContent).toBe('Savoir utiliser Moddy');
    expect(rows[3]!.querySelector('.row-title')!.textContent).toBe('Micro requis');
  });

  it('promises a Lineup check, never says it was done', () => {
    const {container} = renderWithCatalog(<RequirementList requirements={requirements} />);
    const notes = container.querySelectorAll('.requirement-note.promise');
    expect(notes).toHaveLength(1);
    const note = notes[0]!;
    expect(note.textContent).toBe('scheduleVérification par Lineup prévue');
    expect(note.getAttribute('data-tooltip')).toContain("à l'ouverture des candidatures");
    expect(note.getAttribute('data-tooltip')).toContain("Rien n'est vérifié pour le moment");
    expect(note.getAttribute('tabindex')).toBe('0');
    // Not one condition is shown as checked.
    expect(container.textContent).not.toMatch(/vérifiée par Lineup|vérifié par Lineup/i);
  });

  it('says nothing about the viewer without one', () => {
    const {container} = renderWithCatalog(<RequirementList requirements={requirements} />);
    expect(container.querySelector('.requirement-note.viewer')).toBeNull();
  });

  it('tells a signed-in viewer, for information, whether they meet the conditions Lineup can read', () => {
    const {container} = renderWithCatalog(
      <RequirementList
        requirements={[
          ...requirements,
          {type: 'verified_experience', value: null, label: null, verified_by_lineup: true},
        ]}
        viewer={{accountCreatedAt: '2018-05-02T10:11:12+00:00', hasVerifiedExperience: false}}
      />,
    );
    const notes = [...container.querySelectorAll('.requirement-note.viewer')];
    expect(notes.map((note) => note.textContent)).toEqual([
      'check_circleVous remplissez cette condition',
      'radio_button_uncheckedPas encore',
    ]);
    expect(notes[0]!.getAttribute('data-tooltip')).toContain('sans valeur de vérification');
  });

  it('renders nothing for no conditions', () => {
    const {container} = renderWithCatalog(<RequirementList requirements={[]} />);
    expect(container.querySelector('.requirements')).toBeNull();
  });
});

describe('ExperienceRow', () => {
  const experience = makeExperience({
    position: 'moderator',
    name: 'Cubelands FR',
    start_date: '2024-03-01',
    end_date: null,
    verification: {
      status: 'verified',
      method: 'discord_oauth',
      verified_at: '2026-10-20T12:00:00+00:00',
      evidence: null,
      rejection_reason: null,
    },
  });

  it('shows "Position, Name", the dates, the duration and the verification', () => {
    const {container} = renderWithCatalog(
      <Rows as="ul">
        <ExperienceRow experience={experience} />
      </Rows>,
    );
    expect(container.querySelector('li.row .row-title')!.textContent).toBe('Modérateur, Cubelands FR');
    expect(container.querySelector('.row-meta')!.textContent).toMatch(
      /^mars 2024 à aujourd'hui · \d+ ans? \d+ mois$|^mars 2024 à aujourd'hui · \d+ (ans?|mois)$/,
    );
    const pill = screen.getByText('Vérifiée');
    expect(pill.className).toContain('accent');
    expect(pill.getAttribute('data-tooltip')).toBe('Vérifiée via Discord le 20 octobre 2026');
    expect(pill.getAttribute('aria-describedby')).toBeTruthy();
  });

  it('uses the author words for "other", and links the title of a server experience', () => {
    renderWithCatalog(
      <Rows as="ul">
        <ExperienceRow
          experience={{...experience, position: 'other', position_other: 'Archiviste'}}
          href="/guilds/812345678901234567"
        />
      </Rows>,
    );
    const link = screen.getByRole('link', {name: 'Archiviste, Cubelands FR'});
    expect(link.getAttribute('href')).toBe('/guilds/812345678901234567');
  });

  it('does not link a service', () => {
    renderWithCatalog(
      <Rows as="ul">
        <ExperienceRow
          experience={{...experience, kind: 'service', guild_id: null, invite_url: null, name: 'Twitch'}}
          href="/guilds/1"
        />
      </Rows>,
    );
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('Modérateur, Twitch')).toBeTruthy();
  });

  it('shows each verification status', () => {
    const verification = (status: 'unverified' | 'pending' | 'rejected') => ({
      status,
      method: null,
      verified_at: null,
      evidence: null,
      rejection_reason: null,
    });
    renderWithCatalog(
      <Rows as="ul">
        {(['unverified', 'pending', 'rejected'] as const).map((status) => (
          <ExperienceRow key={status} experience={makeExperience({verification: verification(status)})} />
        ))}
      </Rows>,
    );
    expect(screen.getByText('Non vérifiée').className).toContain('neutral');
    expect(screen.getByText('En attente').className).toContain('strong');
    expect(screen.getByText('Refusée').className).toContain('error');
  });

  it('collapses a long description and expands it on request', () => {
    const long = 'Un texte long. '.repeat(30);
    const {container} = renderWithCatalog(
      <Rows as="ul">
        <ExperienceRow experience={{...experience, description: long}} />
      </Rows>,
    );
    const text = container.querySelector('.experience-description') as HTMLElement;
    expect(text.className).toContain('is-clamped');
    fireEvent.click(screen.getByText('Voir plus'));
    expect(text.className).not.toContain('is-clamped');
    fireEvent.click(screen.getByText('Voir moins'));
    expect(text.className).toContain('is-clamped');
  });

  it('shows a short description whole, with no toggle', () => {
    renderWithCatalog(
      <Rows as="ul">
        <ExperienceRow experience={{...experience, description: 'Modération du vocal.'}} />
      </Rows>,
    );
    expect(screen.getByText('Modération du vocal.').className).not.toContain('is-clamped');
    expect(screen.queryByText('Voir plus')).toBeNull();
  });

  it('has a slot for the owner actions', () => {
    renderWithCatalog(
      <Rows as="ul">
        <ExperienceRow experience={experience} actions={<button type="button">Modifier</button>} />
      </Rows>,
    );
    expect(screen.getByRole('button', {name: 'Modifier'})).toBeTruthy();
  });
});

describe('CommitmentSummary and LanguageList', () => {
  it('lists what is set, and nothing when nothing is', () => {
    const {container, rerender} = renderWithCatalog(
      <CommitmentSummary commitment={{hours_per_week: null, compensation: 'paid', openings: 1}} />,
    );
    expect([...container.querySelectorAll('li')].map((li) => li.textContent)).toEqual([
      'paymentsRémunéré',
      'group_add1 poste ouvert',
    ]);
    rerender(<CommitmentSummary commitment={{hours_per_week: null, compensation: null, openings: null}} />);
    expect(container.querySelector('ul')).toBeNull();
    rerender(<CommitmentSummary commitment={null} />);
    expect(contentOf(container)).toHaveLength(0);
  });

  it('names languages as chips, or inline with "+n"', () => {
    const {container} = renderWithCatalog(
      <>
        <LanguageList codes={['fr', 'en', 'es']} />
        <LanguageList codes={['fr', 'en', 'es', 'de']} variant="inline" max={2} />
      </>,
    );
    expect([...container.querySelectorAll('.chip')].map((chip) => chip.textContent)).toEqual([
      'translateFrançais',
      'translateAnglais',
      'translateEspagnol',
    ]);
    const inline = container.querySelector('span[title]')!;
    expect(inline.textContent).toBe('Français, Anglais +2');
    expect(inline.getAttribute('title')).toBe('Français, Anglais, Espagnol, Allemand');
  });
});

describe('LinkList', () => {
  it('opens links in a new tab, safely, with the host in a pill and no external icon', () => {
    const {container} = renderWithCatalog(
      <LinkList
        links={[
          {label: 'Portfolio', url: 'https://www.example.com/alex'},
          {label: 'Piège', url: 'javascript:alert(1)'},
        ]}
      />,
    );
    const links = container.querySelectorAll('a');
    expect(links).toHaveLength(1);
    const link = links[0]!;
    expect(link.getAttribute('href')).toBe('https://www.example.com/alex');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer nofollow');
    expect(link.querySelector('.pill')!.textContent).toBe('example.com');
    expect(link.textContent).not.toContain('open_in_new');
    expect(link.textContent).toContain('Portfolio');
  });

  it('renders nothing when no link is safe', () => {
    const {container} = renderWithCatalog(<LinkList links={[{label: 'x', url: 'javascript:alert(1)'}]} />);
    expect(contentOf(container)).toHaveLength(0);
  });
});

describe('TimezoneLabel', () => {
  beforeEach(() => {
    vi.useFakeTimers({toFake: ['Date', 'setInterval', 'clearInterval']});
    vi.setSystemTime(new Date('2026-10-20T12:32:20Z'));
  });

  it('shows the zone and the local time, for an IANA name and for a UTC offset', () => {
    renderWithCatalog(
      <>
        <TimezoneLabel timezone="Europe/Paris" />
        <TimezoneLabel timezone="UTC-05:30" />
      </>,
    );
    expect(screen.getByText('14:32 heure locale')).toBeTruthy();
    expect(screen.getByText('7:02 heure locale')).toBeTruthy();
    expect(screen.getByText('Europe/Paris').className).toContain('pill');
  });

  it('updates every minute', () => {
    renderWithCatalog(<TimezoneLabel timezone="UTC+02:00" />);
    expect(screen.getByText('14:32 heure locale')).toBeTruthy();
    act(() => void vi.advanceTimersByTime(60_000));
    expect(screen.getByText('14:33 heure locale')).toBeTruthy();
  });

  it('shows the zone alone when the browser does not know it, and nothing without a zone', () => {
    const {container} = renderWithCatalog(
      <>
        <TimezoneLabel timezone="Mars/Olympus" />
        <TimezoneLabel timezone={null} />
      </>,
    );
    expect(container.querySelectorAll('.timezone')).toHaveLength(1);
    expect(container.querySelector('.timezone-time')).toBeNull();
  });
});

describe('RelativeTime', () => {
  it('writes the date relatively, with the full date as title, and refreshes each minute', () => {
    vi.useFakeTimers({toFake: ['Date', 'setInterval', 'clearInterval']});
    vi.setSystemTime(new Date('2026-10-20T12:00:30Z'));
    const {container} = renderWithCatalog(<RelativeTime value="2026-10-20T11:58:00+00:00" />);
    const time = container.querySelector('time') as HTMLTimeElement;
    expect(time.textContent).toBe('il y a 2 minutes');
    expect(time.getAttribute('datetime')).toBe('2026-10-20T11:58:00.000Z');
    expect(time.getAttribute('title')).toMatch(/octobre 2026/);
    act(() => void vi.advanceTimersByTime(3 * 60_000));
    expect(container.querySelector('time')!.textContent).toBe('il y a 5 minutes');
  });

  it('follows the language', async () => {
    const {container} = renderWithCatalog(<RelativeTime value="2020-01-01T00:00:00Z" />);
    expect(container.querySelector('time')!.textContent).toMatch(/il y a \d+ ans/);
    await act(() => i18n.changeLanguage('en'));
    expect(container.querySelector('time')!.textContent).toMatch(/\d+ years ago/);
    await act(() => i18n.changeLanguage('fr'));
  });

  it('renders nothing for an invalid date', () => {
    const {container} = renderWithCatalog(<RelativeTime value="not a date" />);
    expect(contentOf(container)).toHaveLength(0);
  });
});

describe('ApplicationAction', () => {
  const post = makePost({id: 'p1', author_id: '345678901234567890'});

  it('is a Postuler button to the external page, in a new tab', () => {
    const {container} = renderWithCatalog(
      <ApplicationAction
        post={{...post, application: {type: 'external_url', url: 'https://forms.example.com/modo'}}}
      />,
    );
    const button = container.querySelector('md-filled-button')!;
    expect(button.getAttribute('href')).toBe('https://forms.example.com/modo');
    expect(button.getAttribute('target')).toBe('_blank');
    expect(button.getAttribute('rel')).toBe('noopener noreferrer');
    expect(button.textContent).toContain('Postuler');
  });

  it("is a Contacter en MP button to the author's profile, with a line saying it is a Discord DM", () => {
    const {container} = renderWithCatalog(
      <ApplicationAction post={{...post, application: {type: 'discord_dm', url: null}}} />,
    );
    const button = container.querySelector('md-filled-button')!;
    expect(button.getAttribute('href')).toBe('/users/345678901234567890');
    expect(button.textContent).toContain('Contacter en MP');
    expect(screen.getByText(/message privé sur Discord/)).toBeTruthy();
  });

  it('shows nothing without an application, once expired, or when the post is not live', () => {
    for (const overrides of [
      {application: null},
      {application: {type: 'discord_dm' as const, url: null}, is_expired: true},
      {application: {type: 'discord_dm' as const, url: null}, status: 'closed' as const},
      {application: {type: 'discord_dm' as const, url: null}, status: 'draft' as const},
      {application: {type: 'lineup_form' as const, url: null}},
      {application: {type: 'external_url' as const, url: 'javascript:alert(1)'}},
    ]) {
      const {container, unmount} = renderWithCatalog(<ApplicationAction post={{...post, ...overrides}} />);
      expect(container.querySelector('md-filled-button'), JSON.stringify(overrides)).toBeNull();
      unmount();
    }
  });
});

describe('ErrorState', () => {
  const lineup = (status: number, code: string, extra: Partial<ConstructorParameters<typeof ApiError>[0]> = {}) =>
    new ApiError({status, kind: 'lineup', code, ...extra});

  it('says not found for a 404, with no retry', () => {
    renderWithCatalog(<ErrorState error={lineup(404, 'lineup_post_not_found')} onRetry={() => {}} />);
    expect(screen.getByRole('heading', {level: 2}).textContent).toBe('Introuvable');
    expect(screen.getByRole('alert').textContent).toBe('Annonce introuvable ou retirée.');
    expect(screen.queryByText('Réessayer')).toBeNull();
  });

  it('offers a retry after a lost connection, and runs it', () => {
    const retry = vi.fn();
    const {container} = renderWithCatalog(
      <ErrorState error={new ApiError({status: 0, kind: 'network', code: 'network_error'})} onRetry={retry} />,
    );
    expect(screen.getByRole('alert').textContent).toBe('Connexion impossible. Vérifiez votre réseau.');
    fireEvent.click(container.querySelector('md-outlined-button')!);
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('waits out a 429: the retry is disabled with the seconds left', () => {
    vi.useFakeTimers({toFake: ['Date', 'setInterval', 'clearInterval']});
    const error = lineup(429, 'lineup_rate_limited', {retryAfter: 30});
    const {container} = renderWithCatalog(<ErrorState error={error} onRetry={() => {}} />);
    const button = container.querySelector('md-outlined-button')!;
    expect(button.hasAttribute('disabled')).toBe(true);
    expect(button.textContent).toContain('Réessayer dans 30 s');
    act(() => void vi.advanceTimersByTime(30_000));
    expect(container.querySelector('md-outlined-button')!.hasAttribute('disabled')).toBe(false);
    expect(container.querySelector('md-outlined-button')!.textContent).toContain('Réessayer');
    expect(container.querySelector('md-outlined-button')!.textContent).not.toContain('dans');
  });

  it('does not offer a retry for a refusal, nor without a handler', () => {
    const {container, rerender} = renderWithCatalog(
      <ErrorState error={lineup(403, 'lineup_guild_forbidden')} onRetry={() => {}} />,
    );
    expect(container.querySelector('md-outlined-button')).toBeNull();
    rerender(<ErrorState error={lineup(503, 'discord_unavailable', {retryAfter: 30})} />);
    expect(container.querySelector('md-outlined-button')).toBeNull();
  });

  it('has a compact form for inside a section', () => {
    const {container} = renderWithCatalog(<ErrorState compact error={lineup(500, 'x')} onRetry={() => {}} />);
    expect(container.querySelector('.empty-state.compact h3')!.textContent).toBe('Impossible de charger ce contenu');
    expect(container.querySelector('.card')).toBeNull();
  });
});

describe('EmptyState and QuotaMeter', () => {
  it('shows a shape, a title, one sentence and an action', () => {
    renderWithCatalog(
      <EmptyState icon="inbox" title="Aucune annonce" action={<button type="button">Écrire</button>}>
        Les annonces apparaissent ici.
      </EmptyState>,
    );
    expect(screen.getByRole('heading', {level: 2}).textContent).toBe('Aucune annonce');
    expect(screen.getByText('Les annonces apparaissent ici.')).toBeTruthy();
    expect(screen.getByRole('button', {name: 'Écrire'})).toBeTruthy();
  });

  it('is a band with an h3 when compact', () => {
    const {container} = renderWithCatalog(<EmptyState compact icon="inbox" title="Vide" />);
    expect(container.querySelector('.empty-state.compact h3')!.textContent).toBe('Vide');
    expect(container.querySelector('.card')).toBeNull();
  });

  it('counts published posts, and turns to the error color when the quota is full', () => {
    const {container, rerender} = renderWithCatalog(<QuotaMeter used={2} limit={5} scope="guild" />);
    expect(container.querySelector('.quota-text')!.textContent).toBe('2 / 5 annonces publiées sur ce serveur');
    expect(container.querySelector('.quota-meter')!.className).not.toContain('is-full');
    expect(screen.queryByText('Limite atteinte')).toBeNull();
    rerender(<QuotaMeter used={5} limit={5} scope="guild" />);
    expect(container.querySelector('.quota-meter')!.className).toContain('is-full');
    expect(screen.getByText('Limite atteinte').className).toContain('error');
    rerender(<QuotaMeter used={1} limit={3} scope="user" />);
    expect(container.querySelector('.quota-text')!.textContent).toBe('1 / 3 annonces publiées');
  });
});
