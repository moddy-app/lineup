/**
 * The cast: 16 people, written the way people write on Discord communities
 * (headline, bio, links), with a mix of everything the profile page has to
 * show: open to work or not, no Lineup profile at all, Discord badges,
 * avatar decorations, a Moddy staff member, a suspended account.
 */

import type {AvatarDecoration} from '@/api/types';

import type {DbUser, SanctionSpec} from '../model';
import {HOUR, iso} from '../time';
import {avatars} from './assets';
import {G, U} from './ids';

/** Discord `public_flags` bits used below (see logic/badges.ts). */
const FLAG = {
  staff: 1 << 0,
  partnerOwner: 1 << 1,
  hypesquadEvents: 1 << 2,
  bugHunter1: 1 << 3,
  bravery: 1 << 6,
  brilliance: 1 << 7,
  balance: 1 << 8,
  earlySupporter: 1 << 9,
  certifiedModerator: 1 << 18,
  activeDeveloper: 1 << 22,
} as const;

/** `url` is built by the API from the asset hash; it is a string even for an old preset. */
const decoration = (asset: string, sku: string): AvatarDecoration => ({
  asset,
  sku_id: sku,
  url: `https://cdn.discordapp.com/avatar-decoration-presets/${asset}.png`,
});

const ban = (references: string[]): SanctionSpec => ({
  level: 'ban',
  subject_type: 'discord_user',
  references,
  expires_at: null,
});

type Seed = Partial<DbUser> & Pick<DbUser, 'id' | 'username'>;

export function seedUsers(now: Date): Record<string, DbUser> {
  const recent = iso(now.getTime() - 3 * HOUR);
  const old = iso(now.getTime() - 5 * 24 * HOUR);
  const profileAt = (daysAgo: number) => iso(now.getTime() - daysAgo * 24 * HOUR);

  const make = (seed: Seed): DbUser => ({
    global_name: null,
    avatar_url: null,
    avatar_hash: null,
    banner_url: null,
    accent_color: null,
    avatar_decoration: null,
    nameplate: null,
    display_name_styles: null,
    primary_guild: null,
    public_flags: 0,
    is_staff: false,
    premium: false,
    sanction: null,
    snapshot_at: recent,
    snapshot_blocked: false,
    profile: null,
    ...seed,
  });

  const users: DbUser[] = [
    // --- the persona `member` / `dashboard`: a moderator who runs two servers ------------------------------
    make({
      id: U.camille,
      username: 'camille.renard',
      global_name: 'Camille',
      avatar_url: avatars.mia,
      avatar_hash: '9c1a7e4d2b',
      accent_color: 0x7a5af8,
      public_flags: FLAG.balance,
      profile: {
        headline: 'Modératrice et animatrice RP depuis quatre ans',
        bio:
          "J'ai commencé par la modération d'un petit serveur de jeu de rôle, puis j'ai ouvert l'Atelier du Phénix. " +
          "Je m'occupe des équipes de modération, de l'accueil des nouveaux et des sessions de jeu du soir.\n\n" +
          "Je cherche surtout à rejoindre une équipe qui prend le temps de former ses modérateurs.",
        links: [
          {label: 'Portfolio', url: 'https://camille-renard.example.com'},
          {label: 'Atelier du Phénix', url: 'https://atelier-phenix.example.com'},
        ],
        languages: ['fr', 'en'],
        timezone: 'Europe/Paris',
        open_to_work: true,
        created_at: profileAt(210),
        updated_at: profileAt(12),
      },
    }),
    // --- the persona `staff` --------------------------------------------------------------------------
    make({
      id: U.noe,
      username: 'noe_moddy',
      global_name: 'Noé',
      avatar_url: avatars.leo,
      avatar_hash: '3f0b8d51a6',
      accent_color: 0x2f6df6,
      public_flags: FLAG.activeDeveloper | FLAG.bugHunter1,
      is_staff: true,
      premium: true,
      profile: {
        headline: 'Équipe Moddy : support et vérification Lineup',
        bio: "Je réponds au support de Moddy et je traite la file de vérification des expériences sur Lineup. Écrivez-moi sur le serveur Moddy si une revue vous semble bloquée.",
        links: [{label: 'Serveur Moddy', url: 'https://discord.gg/moddy'}],
        languages: ['fr', 'en'],
        timezone: 'Europe/Paris',
        open_to_work: false,
        created_at: profileAt(500),
        updated_at: profileAt(40),
      },
    }),
    // --- the persona `suspended`: a global ban -----------------------------------------------------------
    make({
      id: U.dylan,
      username: 'dylan_hrt',
      global_name: 'Dylan',
      avatar_url: avatars.troublemaker,
      avatar_hash: '5a2e9c07d3',
      sanction: ban(['A7F2K9', 'M4Q8T1']),
      profile: {
        headline: 'Modérateur disponible',
        bio: 'Deux ans de modération sur des serveurs de jeux. Disponible en soirée.',
        links: [],
        languages: ['fr'],
        timezone: 'Europe/Paris',
        open_to_work: true,
        created_at: profileAt(300),
        updated_at: profileAt(60),
      },
    }),
    // --- the persona `newcomer`: signed in, nothing on Lineup yet ----------------------------------------
    make({id: U.ines, username: 'ines.marchand', global_name: 'Inès', avatar_hash: null}),

    make({
      id: U.alex,
      username: 'alex',
      global_name: 'Alex',
      avatar_url: avatars.alex,
      avatar_hash: 'd4e5f6a1b2',
      accent_color: 5793266,
      avatar_decoration: decoration('a_7f3b2c91e0d44f6a8b1c', '1144058844004233369'),
      nameplate: {
        asset: 'nameplates/sakura/',
        palette: 'crimson',
        label: 'COLLECTIBLES_NAMEPLATES_SAKURA_A11Y',
        sku_id: '1349088232164302848',
        url: 'https://cdn.discordapp.com/assets/collectibles/nameplates/sakura/static.png',
      },
      public_flags: FLAG.bravery | FLAG.activeDeveloper,
      premium: true,
      profile: {
        headline: 'Fondateur de Cubelands FR',
        bio: "J'ai lancé Cubelands en 2021 avec trois amis et un serveur de survie. Aujourd'hui l'équipe compte une dizaine de personnes et on recrute toujours des gens calmes et réguliers.",
        links: [{label: 'Cubelands FR', url: 'https://cubelands.example.com'}],
        languages: ['fr'],
        timezone: 'Europe/Paris',
        open_to_work: false,
        created_at: profileAt(420),
        updated_at: profileAt(30),
      },
    }),
    make({
      id: U.sam,
      username: 'samokafor',
      global_name: 'Sam Okafor',
      avatar_url: avatars.sam,
      avatar_hash: '71c8e0b9f4',
      profile: {
        headline: 'Community moderator, five years on large servers',
        bio: "I moderate communities of 10k+ members and I like building clear escalation paths for the team. Mostly evenings (UTC) and weekends.",
        links: [{label: 'LinkedIn', url: 'https://www.linkedin.com/in/sam-okafor-example'}],
        languages: ['en', 'fr'],
        timezone: 'Europe/London',
        open_to_work: true,
        created_at: profileAt(260),
        updated_at: profileAt(9),
      },
    }),
    make({
      id: U.leo,
      username: 'leo_vsr',
      global_name: 'Léo',
      avatar_url: avatars.alex2,
      avatar_hash: 'b83d5f2e11',
      public_flags: FLAG.activeDeveloper,
      profile: {
        headline: 'Développeur de bots Discord (TypeScript)',
        bio: "Je développe et j'héberge des bots communautaires depuis 2021 : tickets, niveaux, automodération. Je maintiens aussi le serveur Dev Corner.",
        links: [
          {label: 'GitHub', url: 'https://github.com/leo-vsr-example'},
          {label: 'Dev Corner', url: 'https://discord.gg/devcorner'},
        ],
        languages: ['fr', 'en'],
        timezone: 'Europe/Paris',
        open_to_work: true,
        created_at: profileAt(180),
        updated_at: profileAt(20),
      },
    }),
    make({
      id: U.lucie,
      username: 'lucie_mrx',
      global_name: 'Lucie',
      profile: {
        headline: 'Community manager, communautés gaming et créateurs',
        bio: "Animation, calendrier d'événements, réseaux sociaux. J'aime les équipes où chacun sait ce qu'il fait.",
        links: [],
        languages: ['fr'],
        timezone: 'Europe/Brussels',
        open_to_work: true,
        created_at: profileAt(150),
        updated_at: profileAt(50),
      },
    }),
    // No Lineup profile edits at all: the page is built from Discord alone.
    make({id: U.theo, username: 'theogarnier', global_name: 'Théo'}),
    make({
      id: U.amira,
      username: 'amira.h',
      global_name: 'Amira',
      avatar_decoration: decoration('a_2c9d41f78e5b4a0b93d6', '1167008329651912835'),
      display_name_styles: {font_id: 3, effect_id: 2, colors: [5793266, 16744192]},
      public_flags: FLAG.certifiedModerator | FLAG.bugHunter1,
      premium: true,
      profile: {
        headline: 'Responsable partenariats chez Anime Plaza',
        bio: "Je négocie les partenariats et je coordonne l'équipe d'animation. Modératrice certifiée Discord.",
        links: [{label: 'Anime Plaza', url: 'https://animeplaza.example.com'}],
        languages: ['fr', 'en', 'ja'],
        timezone: 'Europe/Paris',
        open_to_work: false,
        created_at: profileAt(380),
        updated_at: profileAt(15),
      },
    }),
    make({
      id: U.jonas,
      username: 'jweber',
      global_name: 'Jonas Weber',
      public_flags: FLAG.earlySupporter,
      profile: {
        headline: 'Moderator mit drei Jahren Erfahrung',
        bio: 'Ich moderiere seit drei Jahren deutschsprachige Gaming-Server und helfe gern beim Aufbau von Moderationsteams.',
        links: [],
        languages: ['de', 'en'],
        timezone: 'Europe/Berlin',
        open_to_work: true,
        created_at: profileAt(100),
        updated_at: profileAt(2),
      },
    }),
    // A stale snapshot: the bot cannot refresh it, so the profile says so.
    make({
      id: U.marta,
      username: 'martasilva',
      global_name: 'Marta',
      snapshot_at: old,
      snapshot_blocked: true,
    }),
    make({
      id: U.hugo,
      username: 'hugop',
      global_name: 'Hugo Perrin',
      primary_guild: {identity_guild_id: G.cubelands, identity_enabled: true, tag: 'CBLD', badge: 'c1d2e3f4'},
      profile: {
        headline: 'Modérateur chez Cubelands FR',
        bio: "Étudiant en informatique, je modère le vocal de Cubelands les soirs de semaine.",
        links: [],
        languages: ['fr'],
        timezone: 'Europe/Paris',
        open_to_work: false,
        created_at: profileAt(200),
        updated_at: profileAt(70),
      },
    }),
    make({
      id: U.emma,
      username: 'emmac_dev',
      global_name: 'Emma Collins',
      profile: {
        headline: 'Indie game developer, co-founder of Pixel Forge',
        bio: "I make small games in Godot and run Pixel Forge, a friendly community for people who ship things. We run a game jam every quarter.",
        links: [{label: 'itch.io', url: 'https://emmac.itch.io'}],
        languages: ['en'],
        timezone: 'America/Toronto',
        open_to_work: false,
        created_at: profileAt(330),
        updated_at: profileAt(25),
      },
    }),
    make({
      id: U.karim,
      username: 'karimb',
      global_name: 'Karim',
      profile: {
        headline: 'Fondateur d’Arena Esport FR',
        bio: "On organise des tournois amateurs chaque semaine et on cherche des casteurs et des managers d'équipe.",
        links: [{label: 'Arena Esport FR', url: 'https://arena-esport.example.com'}],
        languages: ['fr'],
        timezone: 'Europe/Paris',
        open_to_work: false,
        created_at: profileAt(240),
        updated_at: profileAt(18),
      },
    }),
    // The account behind the filler posts and the suspended server: banned, so hidden everywhere.
    make({
      id: U.recrut,
      username: 'recrutement.express',
      global_name: 'Recrutement Express',
      sanction: ban(['Z9P3D7']),
    }),
  ];
  return Object.fromEntries(users.map((entry) => [entry.id, entry]));
}
