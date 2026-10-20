/**
 * Sample data for the domain components of the UI gallery (development only):
 * every post status, every experience status, Discord badges, a server
 * without an icon, a person with a decoration. Built on the factories of
 * src/api/fixtures.ts. Images come from the design kit, not from Discord.
 */

import {GUILD_ID, makeExperience, makePost, makeUserProfile} from '@/api/fixtures';
import type {Badge, Link, Post, PrivateExperience, Requirement} from '@/api/types';

export const AVATAR = '/design-kit/assets/avatars/leo.webp';
export const ICON = '/design-kit/assets/avatars/moddy.webp';

/** A frame drawn as an SVG, standing for a Discord avatar decoration (a transparent PNG). */
export const DECORATION_URL =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'%3E%3Ccircle cx='60' cy='60' r='56' fill='none' stroke='orange' stroke-width='6' stroke-dasharray='14 8'/%3E%3C/svg%3E";

export const GUILD_IDS = ['812345678901234567', '812345678901234568', '812345678901234569'];
export const USER_ID = '345678901234567890';

export const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();
export const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();

export const FIVE_MINUTES_AGO = new Date(Date.now() - 5 * 60_000).toISOString();

const label = (fr: string, en: string) => ({fr, en});

export const GUILD_BADGES: Badge[] = [
  {id: 'discord_verified', label: label('Serveur vérifié Discord', 'Discord verified'), source: 'computed'},
  {id: 'moddy_installed', label: label('Moddy installé', 'Moddy installed'), source: 'computed'},
  {id: 'nsfw', label: label('NSFW (18+)', 'NSFW (18+)'), source: 'computed'},
  {id: 'lineup_verified', label: label('Vérifié par Lineup', 'Verified by Lineup'), source: 'manual'},
  {id: 'moddy_server', label: label('Serveur officiel Moddy', 'Official Moddy server'), source: 'manual'},
];

export const USER_BADGES: Badge[] = [
  {id: 'moddy_staff', label: label('Équipe Moddy', 'Moddy team'), source: 'computed'},
  {id: 'moddy_premium', label: label('Moddy Premium', 'Moddy Premium'), source: 'computed'},
  {id: 'discord_hypesquad_events', label: label('HypeSquad Events', 'HypeSquad Events'), source: 'discord'},
  {
    id: 'discord_bug_hunter_level_2',
    label: label('Chasseur de bugs (niveau 2)', 'Bug hunter (level 2)'),
    source: 'discord',
  },
  {
    id: 'discord_hypesquad_house_balance',
    label: label('HypeSquad Balance', 'HypeSquad Balance'),
    source: 'discord',
  },
  {
    id: 'discord_early_verified_bot_developer',
    label: label('Pionnier développeur de bots vérifiés', 'Early verified bot developer'),
    source: 'discord',
  },
  {
    id: 'discord_certified_moderator',
    label: label('Modérateur certifié Discord', 'Discord certified moderator'),
    source: 'discord',
  },
  {id: 'lineup_verified', label: label('Vérifié par Lineup', 'Verified by Lineup'), source: 'manual'},
  {id: 'moddy_partner', label: label('Partenaire Moddy', 'Moddy partner'), source: 'manual'},
  {id: 'unknown_future_badge', label: label('Badge inconnu', 'Unknown badge'), source: 'manual'},
];

export const REQUIREMENTS: Requirement[] = [
  {type: 'min_age', value: 16, label: null, verified_by_lineup: false},
  {type: 'account_age_days', value: 180, label: null, verified_by_lineup: true},
  {type: 'verified_experience', value: null, label: null, verified_by_lineup: true},
  {type: 'experience_months', value: 6, label: null, verified_by_lineup: false},
  {type: 'availability_hours', value: 5, label: null, verified_by_lineup: false},
  {type: 'languages', value: ['fr', 'en'], label: null, verified_by_lineup: false},
  {type: 'voice_required', value: true, label: null, verified_by_lineup: false},
  {type: 'server_activity', value: 'Actif au moins trois soirs par semaine', label: null, verified_by_lineup: false},
  {
    type: 'custom',
    value: 'Savoir utiliser Moddy et configurer les sanctions automatiques sans aide.',
    label: 'Outils',
    verified_by_lineup: false,
  },
];

export const LINKS: Link[] = [
  {label: 'Portfolio', url: 'https://www.example.com/alex'},
  {label: 'Chaîne YouTube avec un libellé particulièrement long pour tester', url: 'https://youtube.com/@alex'},
  {label: 'Mastodon', url: 'https://mastodon.example.social/@alexandre.lemoine.moderation'},
  {label: 'Lien non sûr (filtré)', url: 'javascript:alert(1)'},
];

const guildPost = (overrides: Partial<Post>): Post =>
  makePost({
    guild_id: GUILD_ID,
    guild: {id: GUILD_ID, name: 'Cubelands FR', icon_url: ICON},
    ...overrides,
  });

export const POST_GUILD: Post = guildPost({
  title: 'Cherche 2 modérateurs pour serveur Minecraft FR',
  description:
    'Notre communauté de **4 000 membres** cherche des modérateurs motivés, disponibles en soirée. Vous gérerez les tickets, le vocal et les [règles](https://example.com), avec une équipe qui vous forme.\n\nPas besoin d’expérience, mais de la patience.',
  positions: ['moderator', 'other', 'community_manager'],
  positions_other: ['Gestionnaire de bots'],
  languages: ['fr', 'en', 'es', 'de'],
  commitment: {hours_per_week: 5, compensation: 'volunteer', openings: 2},
  expires_at: inDays(5),
  published_at: hoursAgo(3),
});

export const POST_USER: Post = makePost({
  kind: 'user',
  guild_id: null,
  guild: null,
  title: 'Modératrice expérimentée, disponible dès maintenant',
  description: 'Trois ans de modération sur des serveurs de 10 000 membres, à l’aise avec les outils de Moddy.',
  positions: ['moderator', 'support'],
  languages: ['fr'],
  commitment: {hours_per_week: 12, compensation: 'negotiable', openings: null},
  author: {id: USER_ID, username: 'alex', global_name: 'Alex Martin', avatar_url: AVATAR},
  published_at: hoursAgo(30),
});

export const POST_LONG: Post = guildPost({
  title:
    'Recherche d’un responsable communauté pour un très grand serveur international d’esport et de streaming, titre volontairement trop long',
  description:
    'Un très long texte de description qui dépasse largement les trois lignes autorisées dans la carte du fil, pour vérifier que la coupure se fait proprement avec des points de suspension et que la carte garde une hauteur raisonnable. '.repeat(
      3,
    ),
  guild: {id: GUILD_IDS[1]!, name: 'Un nom de serveur très long qui doit être tronqué proprement', icon_url: null},
  guild_id: GUILD_IDS[1]!,
  positions: ['other', 'graphic_designer', 'partnership_manager', 'event_animator'],
  positions_other: ['Responsable des relations avec les partenaires et les sponsors'],
  languages: ['fr', 'en', 'es', 'de', 'pt', 'it'],
  commitment: {hours_per_week: 168, compensation: 'paid', openings: 12},
  expires_at: inDays(1),
});

export const POST_STATUSES: Post[] = [
  guildPost({title: 'Brouillon : serveur de jeu de rôle', status: 'draft', published_at: null}),
  guildPost({title: 'Publiée : événements du week-end', status: 'published', expires_at: inDays(40)}),
  guildPost({title: 'Fermée : recrutement terminé', status: 'closed'}),
  guildPost({title: 'Masquée par l’équipe Moddy', status: 'hidden'}),
  guildPost({title: 'Publiée mais expirée', status: 'published', is_expired: true, expires_at: inDays(-2)}),
];

const verification = (overrides: Partial<PrivateExperience['verification']>): PrivateExperience['verification'] => ({
  status: 'unverified',
  method: null,
  verified_at: null,
  evidence: null,
  rejection_reason: null,
  ...overrides,
});

const LONG_DESCRIPTION =
  'Modération du texte et du vocal, gestion des tickets, formation des nouveaux modérateurs, rédaction des règles et suivi des sanctions avec Moddy. Mise en place d’un système de rotation pour couvrir tous les fuseaux horaires, et animation de deux événements par mois.';

export const EXPERIENCES: PrivateExperience[] = [
  makeExperience({
    guild_id: GUILD_IDS[0],
    name: 'Cubelands FR',
    position: 'moderator',
    start_date: '2024-03-01',
    end_date: null,
    description: LONG_DESCRIPTION,
    verification: verification({status: 'verified', method: 'discord_oauth', verified_at: '2026-10-20T14:10:44+00:00'}),
  }),
  makeExperience({
    guild_id: GUILD_IDS[1],
    name: 'Night Owls',
    position: 'admin',
    start_date: '2021-01-15',
    end_date: '2023-03-31',
    is_current: false,
    description: 'Administration du serveur et des bots.',
    verification: verification({status: 'verified', method: 'moddy_staff', verified_at: '2025-06-02T09:00:00+00:00'}),
  }),
  makeExperience({
    guild_id: GUILD_IDS[2],
    name: 'Pixel League',
    position: 'other',
    position_other: 'Responsable des relations partenaires',
    start_date: '2026-09-20',
    end_date: null,
    verification: verification({status: 'pending'}),
  }),
  makeExperience({
    guild_id: GUILD_IDS[0],
    name: 'Ink & Pixels',
    position: 'community_manager',
    start_date: '2020-11-01',
    end_date: '2021-02-10',
    is_current: false,
    verification: verification({status: 'unverified'}),
  }),
  makeExperience({
    kind: 'service',
    guild_id: null,
    invite_url: null,
    name: 'Chaîne Twitch d’un créateur de contenu très connu',
    position: 'moderator',
    start_date: '2022-05-01',
    end_date: '2024-05-01',
    is_current: false,
    verification: verification({
      status: 'rejected',
      rejection_reason: 'Preuve insuffisante.',
    }),
  }),
];

export const VIEWER = {
  accountCreatedAt: '2024-01-10T00:00:00+00:00',
  hasVerifiedExperience: false,
};

export const PROFILE_WITH_DECORATION = makeUserProfile({
  avatar_url: AVATAR,
  avatar_decoration: {asset: 'a_demo', sku_id: null, url: DECORATION_URL},
});
