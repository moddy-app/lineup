/**
 * Servers as Discord knows them (name, icon, members, features, NSFW level,
 * the bot), the Lineup profiles of the claimed ones, who is on which server
 * and with which permissions, and the invitations Discord can resolve.
 */

import type {Link} from '@/api/types';

import type {DiscordGuild, GuildProfileRow, Invite, Member, SanctionSpec} from '../model';
import {DAY, HOUR, iso} from '../time';
import {avatars} from './assets';
import {G, U} from './ids';

type GuildSeed = Partial<DiscordGuild> & Pick<DiscordGuild, 'id' | 'name' | 'owner_id'>;

const makeGuild = (seed: GuildSeed): DiscordGuild => ({
  icon_url: null,
  banner_url: null,
  splash_url: null,
  description: null,
  features: [],
  nsfw_level: 0,
  premium_subscription_count: 0,
  premium_tier: 0,
  vanity_url_code: null,
  member_count: null,
  presence_count: null,
  verification_level: 1,
  has_moddy: false,
  premium_effective: false,
  sanction: null,
  ...seed,
});

const banGuild = (references: string[]): SanctionSpec => ({
  level: 'ban',
  subject_type: 'guild',
  references,
  expires_at: null,
});

/** Every server Discord has in the mock (claimed on Lineup or not). Icons are null on purpose: the app draws a shape. */
export function seedDiscordGuilds(): DiscordGuild[] {
  return [
    makeGuild({
      id: G.cubelands,
      name: 'Cubelands FR',
      owner_id: U.alex,
      description: 'Survie, mini-jeux et bonne humeur.',
      features: ['COMMUNITY', 'NEWS', 'DISCOVERABLE'],
      premium_subscription_count: 14,
      premium_tier: 3,
      member_count: 4120,
      presence_count: 640,
      has_moddy: true,
      premium_effective: true,
    }),
    makeGuild({
      id: G.moddy,
      name: 'Moddy',
      owner_id: U.noe,
      icon_url: avatars.moddy,
      description: 'Le serveur officiel de Moddy : support, annonces et suggestions.',
      features: ['COMMUNITY', 'VERIFIED', 'NEWS', 'DISCOVERABLE'],
      premium_subscription_count: 31,
      premium_tier: 3,
      member_count: 12480,
      presence_count: 2310,
      has_moddy: true,
      premium_effective: true,
      verification_level: 2,
    }),
    makeGuild({
      id: G.atelier,
      name: 'Atelier du Phénix',
      owner_id: U.camille,
      description: "Serveur de jeu de rôle textuel dans le royaume d'Ellandre.",
      features: ['COMMUNITY'],
      premium_subscription_count: 5,
      premium_tier: 1,
      member_count: 1860,
      presence_count: 290,
      has_moddy: true,
    }),
    makeGuild({
      id: G.pixel,
      name: 'Pixel Forge',
      owner_id: U.emma,
      description: 'A friendly community for indie game developers.',
      features: ['COMMUNITY'],
      premium_subscription_count: 2,
      premium_tier: 0,
      member_count: 2750,
      presence_count: 410,
    }),
    makeGuild({
      id: G.anime,
      name: 'Anime Plaza',
      owner_id: '613004510922727424',
      vanity_url_code: 'animeplaza',
      description: 'Simulcasts, watch parties and a lot of opinions about openings.',
      features: ['COMMUNITY', 'VERIFIED', 'PARTNERED', 'DISCOVERABLE', 'VANITY_URL'],
      premium_subscription_count: 58,
      premium_tier: 3,
      member_count: 38200,
      presence_count: 5120,
      has_moddy: true,
      verification_level: 2,
    }),
    // Lineup theme `nsfw`, Discord level 0: the two NSFW paths are separate (§9).
    makeGuild({
      id: G.velvet,
      name: 'Velvet Lounge',
      owner_id: U.jonas,
      description: 'Salon de discussion réservé aux adultes. Pas de contenu explicite en dehors des salons dédiés.',
      member_count: 3320,
      presence_count: 410,
      verification_level: 3,
    }),
    // Discord level 3 (age-restricted), Lineup theme `community`.
    makeGuild({
      id: G.nox,
      name: 'Nox After Dark',
      owner_id: U.karim,
      description: 'Communauté 18+ : discussions, musique et soirées vocales tardives.',
      features: ['COMMUNITY'],
      nsfw_level: 3,
      member_count: 9100,
      presence_count: 1500,
      has_moddy: true,
      verification_level: 3,
    }),
    makeGuild({
      id: G.hyrule,
      name: "Terres d'Hyrule RP",
      owner_id: U.leo,
      description: 'Jeu de rôle autour de l’univers de Zelda.',
      member_count: 640,
      presence_count: 70,
    }),
    makeGuild({
      id: G.trade,
      name: 'Trade Hub Gains',
      owner_id: U.recrut,
      description: 'Signaux de trading et revenus passifs.',
      member_count: 5200,
      presence_count: 800,
      sanction: banGuild(['Q2W8E5']),
    }),
    makeGuild({
      id: G.lumen,
      name: 'Lumen Study',
      owner_id: U.theo,
      description: "Salons d'étude, partage de fiches et entraide pour le lycée et les prépas.",
      member_count: 910,
      presence_count: 120,
    }),
    // The bot was removed after the snapshot was taken: the profile still says `has_moddy`, the live list does not.
    makeGuild({
      id: G.devcorner,
      name: 'Dev Corner',
      owner_id: U.leo,
      description: 'Entraide autour du développement de bots et d’applications Discord.',
      features: ['COMMUNITY'],
      member_count: 1470,
      presence_count: 180,
      has_moddy: false,
    }),
    makeGuild({
      id: G.arena,
      name: 'Arena Esport FR',
      owner_id: U.karim,
      description: 'Tournois amateurs hebdomadaires, scrims et recherche de coéquipiers.',
      features: ['COMMUNITY', 'DISCOVERABLE'],
      premium_subscription_count: 9,
      premium_tier: 2,
      member_count: 6700,
      presence_count: 980,
      has_moddy: true,
    }),
    // ---- not claimed on Lineup -------------------------------------------------------------------------------
    makeGuild({
      id: G.cafe,
      name: 'Café des Mods',
      owner_id: U.camille,
      description: 'Le salon des modérateurs et modératrices : outils, retours d’expérience et entraide.',
      member_count: 520,
      presence_count: 64,
      has_moddy: true,
    }),
    makeGuild({
      id: G.studio,
      name: 'Studio Nocturne',
      owner_id: '702118340077371392',
      description: 'Collectif de musique et d’illustration.',
      member_count: 1240,
      presence_count: 150,
    }),
    makeGuild({
      id: G.corbeau,
      name: 'Guilde du Corbeau',
      owner_id: U.camille,
      description: 'Clan de jeux de stratégie.',
      member_count: 310,
      presence_count: 45,
    }),
    makeGuild({
      id: G.lumiere,
      name: 'Lumière Studio',
      owner_id: '802554919100833792',
      description: 'Studio de design et communauté de créatifs.',
      member_count: 2100,
      presence_count: 260,
    }),
    makeGuild({
      id: G.chroniqueurs,
      name: 'Les Chroniqueurs',
      owner_id: U.ines,
      description: "Communauté d'écriture : ateliers, relectures et défis mensuels.",
      member_count: 430,
      presence_count: 52,
    }),
    // Banned after reports, never claimed: the person who runs it hits `guild_suspended` when she tries.
    makeGuild({
      id: G.marche,
      name: 'Marché des Arcanes',
      owner_id: U.camille,
      description: "Place d'échange de cartes à collectionner et de comptes de jeu.",
      member_count: 880,
      presence_count: 95,
      sanction: banGuild(['R5T3N7']),
    }),
  ];
}

const links = (...entries: Array<[string, string]>): Link[] => entries.map(([label, url]) => ({label, url}));

type ProfileSeed = Pick<GuildProfileRow, 'guild_id' | 'invite_code' | 'claimed_by'> & Partial<GuildProfileRow>;

/** The claimed profiles; `daysAgo` is when they were claimed (it orders the directory). */
export function seedGuildProfiles(now: Date): GuildProfileRow[] {
  const claimed = (daysAgo: number) => iso(now.getTime() - daysAgo * DAY);
  const fresh = iso(now.getTime() - 2 * HOUR);
  const make = (seed: ProfileSeed & {daysAgo: number}): GuildProfileRow => {
    const {daysAgo, ...rest} = seed;
    return {
      description: null,
      links: [],
      theme: null,
      tags: [],
      languages: [],
      snapshot_at: fresh,
      has_moddy: false,
      listed: true,
      invite_invalid: false,
      refresh_blocked: false,
      created_at: claimed(daysAgo),
      updated_at: claimed(Math.max(0, daysAgo - 3)),
      ...rest,
    };
  };
  return [
    make({
      guild_id: G.cubelands,
      invite_code: 'cubelands',
      claimed_by: U.alex,
      daysAgo: 400,
      description:
        'Le plus grand serveur de survie Minecraft francophone. Saisons, mini-jeux, économie de serveur et une équipe de modération qui répond vite.',
      links: links(['Site', 'https://cubelands.example.com'], ['Wiki', 'https://wiki.cubelands.example.com']),
      theme: 'gaming',
      tags: ['minecraft', 'survie', 'francophone'],
      languages: ['fr'],
      has_moddy: true,
    }),
    make({
      guild_id: G.moddy,
      invite_code: 'moddy',
      claimed_by: U.noe,
      daysAgo: 600,
      description:
        'Le serveur officiel de Moddy. Support, annonces de version, suggestions et un salon pour présenter son serveur Lineup.',
      links: links(['Site', 'https://moddy.app'], ['Documentation', 'https://docs.moddy.app']),
      theme: 'tech',
      tags: ['moddy', 'bot', 'support'],
      languages: ['fr', 'en'],
      has_moddy: true,
    }),
    make({
      guild_id: G.atelier,
      invite_code: 'atelier-phenix',
      claimed_by: U.camille,
      daysAgo: 90,
      description:
        "Un jeu de rôle textuel dans le royaume d'Ellandre. Les sessions ont lieu le soir, les saisons durent trois mois et chaque joueur peut proposer ses propres intrigues.",
      links: links(['Règlement', 'https://atelier-phenix.example.com/reglement']),
      theme: 'roleplay',
      tags: ['jdr', 'fantasy', 'rp-textuel'],
      languages: ['fr'],
      has_moddy: true,
    }),
    make({
      guild_id: G.pixel,
      invite_code: 'pixelforge',
      claimed_by: U.camille,
      daysAgo: 35,
      description:
        'Pixel Forge is a community for people who make small games: feedback threads, a showcase channel, and a game jam every quarter.',
      links: links(['Jam page', 'https://pixelforge.example.com/jam']),
      theme: 'tech',
      tags: ['gamedev', 'indie', 'godot'],
      languages: ['en', 'fr'],
    }),
    make({
      guild_id: G.anime,
      invite_code: 'animeplaza',
      claimed_by: '613004510922727424',
      daysAgo: 200,
      description:
        "Simulcasts, watch parties hebdomadaires et salons par série. L'équipe de modération est répartie sur plusieurs fuseaux horaires.",
      links: links(['Site', 'https://animeplaza.example.com']),
      theme: 'anime',
      tags: ['anime', 'manga', 'watchparty'],
      languages: ['fr', 'en'],
      has_moddy: true,
    }),
    make({
      guild_id: G.velvet,
      invite_code: 'velvetlounge',
      claimed_by: U.jonas,
      daysAgo: 70,
      description: 'Communauté réservée aux adultes. Le règlement est strict sur le consentement et la vie privée.',
      theme: 'nsfw',
      tags: ['18plus', 'discussion'],
      languages: ['fr'],
    }),
    make({
      guild_id: G.nox,
      invite_code: 'noxafterdark',
      claimed_by: U.karim,
      daysAgo: 80,
      description: 'Soirées vocales, musique et discussions tardives. Serveur réservé aux personnes majeures.',
      theme: 'community',
      tags: ['18plus', 'vocal'],
      languages: ['fr'],
      has_moddy: true,
    }),
    // Unlisted: absent from the directory and unreadable by anyone who does not manage it.
    make({
      guild_id: G.hyrule,
      invite_code: 'hyrule-rp',
      claimed_by: U.leo,
      daysAgo: 50,
      description: 'Jeu de rôle autour de Zelda, en préparation. Le profil est encore masqué de l’annuaire.',
      theme: 'roleplay',
      tags: ['zelda', 'rp'],
      languages: ['fr'],
      listed: false,
    }),
    // Suspended globally: no profile for the public, its posts leave every list.
    make({
      guild_id: G.trade,
      invite_code: 'tradehub',
      claimed_by: U.recrut,
      daysAgo: 45,
      description: 'Rejoignez nos signaux et multipliez votre capital.',
      theme: 'other',
      tags: ['trading'],
      languages: ['fr'],
    }),
    // The invitation was deleted on Discord: `invite.valid` is false.
    make({
      guild_id: G.lumen,
      invite_code: 'lumen-study',
      claimed_by: U.theo,
      daysAgo: 20,
      description:
        "Un serveur d'entraide pour les élèves de lycée et de classes préparatoires, géré par d'anciens élèves.",
      theme: 'education',
      tags: ['etudes', 'entraide', 'lycee'],
      languages: ['fr'],
      invite_invalid: true,
    }),
    // A stale snapshot that cannot be refreshed, and a bot that has left since.
    make({
      guild_id: G.devcorner,
      invite_code: 'devcorner',
      claimed_by: U.leo,
      daysAgo: 3,
      description: 'Entraide autour du développement de bots : revues de code, hébergement et bonnes pratiques.',
      theme: 'tech',
      tags: ['discord-js', 'bots', 'typescript'],
      languages: ['fr', 'en'],
      has_moddy: true,
      snapshot_at: iso(now.getTime() - 3 * DAY),
      refresh_blocked: true,
    }),
    make({
      guild_id: G.arena,
      invite_code: 'arena-esport',
      claimed_by: U.karim,
      daysAgo: 9,
      description:
        'Des tournois amateurs chaque semaine, des scrims et un système de ligues. On cherche des casteurs et des managers.',
      links: links(['Classement', 'https://arena-esport.example.com/classement']),
      theme: 'esport',
      tags: ['tournoi', 'valorant', 'league'],
      languages: ['fr'],
      has_moddy: true,
    }),
  ];
}

const perms = (...names: string[]) => names;

/** Who is on which server, with the permissions Discord gives them (the base ones, §7). */
export function seedMembers(): Member[] {
  const m = (user_id: string, guild_id: string, owner: boolean, permissions: string[], role_count: number): Member => ({
    user_id,
    guild_id,
    owner,
    permissions,
    role_count,
  });
  return [
    // Camille ("member"): the whole range of cases of §3 and §7.
    m(U.camille, G.atelier, true, perms('ADMINISTRATOR'), 6),
    m(U.camille, G.pixel, false, perms('ADMINISTRATOR'), 5),
    m(U.camille, G.cafe, true, perms('ADMINISTRATOR'), 4),
    m(U.camille, G.studio, false, perms('MANAGE_GUILD', 'MANAGE_MESSAGES'), 3),
    m(U.camille, G.corbeau, true, perms('ADMINISTRATOR'), 5),
    m(U.camille, G.marche, true, perms('ADMINISTRATOR'), 4),
    m(U.camille, G.cubelands, false, perms('MANAGE_MESSAGES', 'MODERATE_MEMBERS'), 4),
    m(U.camille, G.anime, false, perms(), 2),
    // (Camille is not on Lumière Studio at all.)
    m(U.ines, G.chroniqueurs, true, perms('ADMINISTRATOR'), 3),
    m(U.noe, G.moddy, true, perms('ADMINISTRATOR'), 8),
    m(U.alex, G.cubelands, true, perms('ADMINISTRATOR'), 9),
    m(U.hugo, G.cubelands, false, perms('MANAGE_MESSAGES', 'KICK_MEMBERS'), 3),
    m(U.lucie, G.cubelands, false, perms('MANAGE_MESSAGES', 'MANAGE_EVENTS'), 3),
    m(U.dylan, G.cubelands, false, perms('MANAGE_MESSAGES'), 2),
    m(U.amira, G.anime, false, perms('ADMINISTRATOR'), 7),
    m(U.sam, G.anime, false, perms('MODERATE_MEMBERS', 'KICK_MEMBERS'), 4),
    m(U.emma, G.pixel, true, perms('ADMINISTRATOR'), 6),
    m(U.karim, G.arena, true, perms('ADMINISTRATOR'), 8),
    m(U.karim, G.nox, true, perms('ADMINISTRATOR'), 5),
    m(U.leo, G.devcorner, true, perms('ADMINISTRATOR'), 4),
    m(U.leo, G.hyrule, true, perms('ADMINISTRATOR'), 4),
    m(U.jonas, G.velvet, true, perms('ADMINISTRATOR'), 4),
    m(U.theo, G.lumen, true, perms('ADMINISTRATOR'), 3),
    m(U.recrut, G.trade, true, perms('ADMINISTRATOR'), 2),
  ];
}

/**
 * Invitations as Discord resolves them (§3). A code that is not here is
 * unknown (`invite_not_found`). Every claimable server has a permanent one.
 * The full table of test codes is in ../README.md.
 */
export function seedInvites(now: Date): Invite[] {
  const permanent = (code: string, guild_id: string): Invite => ({code, kind: 'guild', guild_id, expires_at: null});
  return [
    permanent('cubelands', G.cubelands),
    permanent('moddy', G.moddy),
    permanent('atelier-phenix', G.atelier),
    permanent('pixelforge', G.pixel),
    permanent('animeplaza', G.anime),
    permanent('velvetlounge', G.velvet),
    permanent('noxafterdark', G.nox),
    permanent('hyrule-rp', G.hyrule),
    permanent('tradehub', G.trade),
    permanent('devcorner', G.devcorner),
    permanent('arena-esport', G.arena),
    // The invitation of the `lumen` profile is gone from Discord: `lumen-study` is not here on purpose.
    permanent('cafe-des-mods', G.cafe),
    permanent('studio-nocturne', G.studio),
    permanent('corbeau-guilde', G.corbeau),
    permanent('lumiere', G.lumiere),
    permanent('chroniqueurs', G.chroniqueurs),
    permanent('marche-arcanes', G.marche),
    // Permanent invitations of a second kind: a second code to the same server (to change a profile's invitation).
    permanent('cubelands-fr', G.cubelands),
    permanent('atelier', G.atelier),
    // Cases for the claim errors:
    {code: 'nocturne-temp', kind: 'guild', guild_id: G.studio, expires_at: iso(now.getTime() + 2 * DAY)},
    {code: 'vieux-code', kind: 'guild', guild_id: G.studio, expires_at: iso(now.getTime() - 3 * DAY)},
    {code: 'groupe-mp', kind: 'group_dm', guild_id: null, expires_at: null},
    {code: 'ami-ouvert', kind: 'friend', guild_id: null, expires_at: null},
  ];
}
