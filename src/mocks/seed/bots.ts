/**
 * The App Directory and the bot profiles. Who can claim or manage what, for
 * Camille: Pixel Helper (admin of Pixel Forge, claimed), Atelier Bot (owner of
 * L'Atelier Phénix, not claimed yet: `can_claim`), Studio Beats (only "Manage
 * server" on Studio Nocturne: not enough), Cube Guard (claimed by Alex). The
 * table of ids is in ../README.md.
 */

import type {BotProfileRow, DiscordBot} from '../model';
import {DAY, iso} from '../time';
import {avatars} from './assets';
import {B, G, U} from './ids';

const bot = (fields: Partial<DiscordBot> & Pick<DiscordBot, 'id' | 'name'>): DiscordBot => ({
  avatar_url: null,
  description: null,
  guild_count: null,
  is_verified: false,
  discord_tags: [],
  categories: [],
  discoverable: true,
  support_guild_id: null,
  ...fields,
});

export function seedDiscordBots(): DiscordBot[] {
  return [
    bot({
      id: B.moddy,
      name: 'Moddy',
      avatar_url: avatars.moddy,
      description: 'Modération, tickets et outils de communauté, configurables depuis un tableau de bord.',
      guild_count: 48_200,
      is_verified: true,
      discord_tags: ['Moderation', 'Tickets', 'Utility'],
      categories: ['Moderation and Tools'],
      support_guild_id: G.moddy,
    }),
    bot({
      id: B.pixel,
      name: 'Pixel Helper',
      avatar_url: avatars.mia,
      description: 'Partage de créations, défis hebdomadaires et galerie pour les serveurs de pixel art.',
      guild_count: 1_840,
      discord_tags: ['Art', 'Fun'],
      categories: ['Fun'],
      support_guild_id: G.pixel,
    }),
    bot({
      id: B.cube,
      name: 'Cube Guard',
      avatar_url: avatars.alex2,
      description: 'Liaison Minecraft et Discord : comptes liés, statut du serveur et sanctions synchronisées.',
      guild_count: 12_600,
      is_verified: true,
      discord_tags: ['Minecraft', 'Moderation'],
      categories: ['Games', 'Moderation and Tools'],
      support_guild_id: G.cubelands,
    }),
    bot({
      id: B.nox,
      name: 'Nox',
      avatar_url: null,
      description: 'Jeux de rôle pour adultes et salons de nuit.',
      guild_count: 920,
      discord_tags: ['Roleplay'],
      categories: ['Social'],
      support_guild_id: G.nox,
    }),
    bot({
      id: B.devhelper,
      name: 'Dev Helper',
      avatar_url: avatars.leo,
      description: 'Revue de code et rappels de déploiement.',
      guild_count: 310,
      discord_tags: ['Developer Tools'],
      categories: ['Utility'],
      support_guild_id: G.devcorner,
    }),
    bot({
      id: B.marche,
      name: 'Marché Bot',
      description: 'Échanges et enchères.',
      guild_count: 75,
      support_guild_id: G.marche,
    }),
    bot({
      id: B.atelier,
      name: 'Atelier Bot',
      avatar_url: avatars.sam,
      description: 'Commandes et suivi des créations de L’Atelier Phénix.',
      guild_count: 140,
      discord_tags: ['Art'],
      categories: ['Utility'],
      support_guild_id: G.atelier,
    }),
    bot({
      id: B.beats,
      name: 'Studio Beats',
      description: 'Musique en vocal, playlists partagées.',
      guild_count: 5_300,
      discord_tags: ['Music'],
      categories: ['Music'],
      support_guild_id: G.studio,
    }),
    bot({
      id: B.ghost,
      name: 'Ghost',
      description: 'Pas découvrable.',
      guild_count: 12,
      discoverable: false,
      support_guild_id: G.atelier,
    }),
    bot({id: B.lonely, name: 'Lonely', description: 'Sans serveur support.', guild_count: 3}),
  ];
}

export function seedBotProfiles(now: Date): BotProfileRow[] {
  const ago = (days: number) => iso(now.getTime() - days * DAY);
  const row = (fields: Partial<BotProfileRow> & Pick<BotProfileRow, 'bot_id' | 'claimed_by'>): BotProfileRow => ({
    description: null,
    links: [],
    theme: 'tech',
    tags: [],
    languages: ['fr'],
    listed: true,
    support_guild_id: null,
    snapshot_at: ago(0.1),
    refresh_blocked: false,
    created_at: ago(30),
    updated_at: ago(2),
    ...fields,
  });
  return [
    row({
      bot_id: B.moddy,
      claimed_by: U.noe,
      support_guild_id: G.moddy,
      description:
        'Moddy aide les équipes de modération : sanctions, tickets, journaux et rôles automatiques.\n\nNous cherchons des personnes pour le support et la traduction.',
      links: [
        {label: 'Site', url: 'https://moddy.app'},
        {label: 'Documentation', url: 'https://docs.moddy.app'},
      ],
      tags: ['moderation', 'tickets'],
      languages: ['fr', 'en'],
      created_at: ago(90),
    }),
    row({
      bot_id: B.pixel,
      claimed_by: U.camille,
      support_guild_id: G.pixel,
      theme: 'art',
      tags: ['pixel-art'],
      created_at: ago(12),
    }),
    row({
      bot_id: B.cube,
      claimed_by: U.alex,
      support_guild_id: G.cubelands,
      theme: 'gaming',
      tags: ['minecraft'],
      description: 'Le bot qui relie Cubelands FR à Minecraft. Nous recrutons un développeur Java.',
      created_at: ago(40),
    }),
    row({bot_id: B.nox, claimed_by: U.karim, support_guild_id: G.nox, theme: 'nsfw', created_at: ago(20)}),
    row({bot_id: B.devhelper, claimed_by: U.leo, support_guild_id: G.devcorner, listed: false, created_at: ago(8)}),
    row({bot_id: B.marche, claimed_by: U.camille, support_guild_id: G.marche, created_at: ago(15)}),
  ];
}
