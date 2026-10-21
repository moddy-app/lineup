/**
 * Posts of every kind and status: published (live and expired), draft,
 * closed, hidden by the staff; server posts and personal posts; every
 * requirement type, every way to apply, `other` positions, featured
 * experiences. Plus the "filler" posts of a banned account that make a page
 * of the feed come back empty with a cursor (LINEUP.md §0).
 */

import type {Application, Commitment, Requirement} from '@/api/types';

import type {DbPost} from '../model';
import {DAY, iso, MINUTE} from '../time';
import {experienceId, fillerPostId, G, postId as pid, U} from './ids';

const requirement = (
  type: string,
  value: Requirement['value'] = null,
  extra: Partial<Pick<Requirement, 'label' | 'verified_by_lineup'>> = {},
): Requirement => ({type, value, label: extra.label ?? null, verified_by_lineup: extra.verified_by_lineup ?? false});

const url = (target: string): Application => ({type: 'external_url', url: target});
const dm: Application = {type: 'discord_dm', url: null};
const commit = (hours: number | null, compensation: string | null, openings: number | null): Commitment => ({
  hours_per_week: hours,
  compensation,
  openings,
});

type PostSeed = Pick<DbPost, 'kind' | 'author_id' | 'title' | 'description' | 'positions'> & Partial<DbPost>;

export function seedPosts(now: Date): DbPost[] {
  const ago = (days: number) => iso(now.getTime() - days * DAY);
  const from = (days: number) => iso(now.getTime() + days * DAY);

  /** `published`: days since the first publication; the creation is half an hour earlier. */
  const make = (n: number, seed: PostSeed & {published?: number}): DbPost => {
    const {published, ...rest} = seed;
    const createdAt = published !== undefined ? iso(now.getTime() - published * DAY - 30 * MINUTE) : ago(2);
    return {
      id: pid(n),
      guild_id: null,
      positions_other: [],
      requirements: [],
      application: null,
      languages: ['fr'],
      timezone: null,
      commitment: null,
      theme: null,
      tags: [],
      featured_experience_id: null,
      status: 'published',
      hidden_reason: null,
      expires_at: null,
      published_at: published !== undefined ? ago(published) : null,
      created_at: createdAt,
      updated_at: published !== undefined ? ago(Math.max(0, published - 0.05)) : createdAt,
      ...rest,
    };
  };

  const guildPost = (
    guild: string,
    author: string,
    seed: Omit<PostSeed, 'kind' | 'author_id'> & {published?: number},
  ) => ({kind: 'guild', guild_id: guild, author_id: author, ...seed}) as PostSeed & {published?: number};
  const userPost = (author: string, seed: Omit<PostSeed, 'kind' | 'author_id'> & {published?: number}) =>
    ({kind: 'user', author_id: author, ...seed}) as PostSeed & {published?: number};

  return [
    // ---- Cubelands FR (Alex) -------------------------------------------------------------------------------
    make(
      1,
      guildPost(G.cubelands, U.alex, {
        title: 'Cherche 2 modérateurs pour serveur Minecraft FR',
        description:
          "Notre communauté de 4 000 membres cherche des modérateurs motivés, disponibles en soirée et le week-end. Vous gérez le texte et le vocal, vous répondez aux tickets et vous appliquez notre règlement avec calme.\n\nUne formation de deux semaines est assurée par l'équipe actuelle, et tout se passe sur notre serveur de modération privé.",
        positions: ['moderator', 'other'],
        positions_other: ['Gestionnaire de bots'],
        requirements: [
          requirement('min_age', 16),
          requirement('account_age_days', 180, {verified_by_lineup: true}),
          requirement('custom', 'Savoir utiliser Moddy', {label: 'Outils'}),
        ],
        application: url('https://forms.example.com/modo'),
        timezone: 'Europe/Paris',
        commitment: commit(5, 'volunteer', 2),
        theme: 'gaming',
        tags: ['minecraft', 'survie'],
        published: 6,
      }),
    ),
    make(
      2,
      guildPost(G.cubelands, U.alex, {
        title: "Graphiste pour l'habillage de la saison 6",
        description:
          "Nous préparons la saison 6 et nous avons besoin d'un ou d'une graphiste pour les bannières, les icônes de rangs et les visuels d'annonce. Vous travaillez avec l'équipe d'animation, avec une direction artistique déjà définie.\n\nPaiement à la mission, devis sur demande.",
        positions: ['graphic_designer'],
        requirements: [requirement('experience_months', 12), requirement('availability_hours', 6)],
        application: dm,
        commitment: commit(null, 'paid', 1),
        theme: 'gaming',
        tags: ['graphisme', 'minecraft'],
        expires_at: from(20),
        published: 4,
      }),
    ),
    make(
      3,
      guildPost(G.cubelands, U.alex, {
        title: "Animateur d'événements du week-end",
        description:
          "Chaque samedi, nous organisons un événement : chasse au trésor, construction en équipe, quiz vocal. Nous cherchons deux personnes à l'aise au micro pour les préparer et les animer.",
        positions: ['event_animator'],
        requirements: [requirement('voice_required', true), requirement('languages', ['fr'])],
        application: url('https://forms.example.com/cubelands-animation'),
        commitment: commit(3, 'volunteer', 2),
        theme: 'gaming',
        tags: ['evenements', 'vocal'],
        published: 2,
      }),
    ),
    make(
      4,
      guildPost(G.cubelands, U.alex, {
        title: 'Support tickets : recrutement à préparer',
        description:
          'Brouillon : nous voulons ouvrir deux places au support des tickets en janvier, avec une période de test de trois semaines.',
        positions: ['support'],
        status: 'draft',
        theme: 'gaming',
      }),
    ),
    make(
      5,
      guildPost(G.cubelands, U.alex, {
        title: 'Modérateur vocal (recrutement terminé)',
        description:
          "Nous avons trouvé les personnes qu'il nous fallait pour le vocal. Merci à toutes celles et ceux qui ont candidaté.",
        positions: ['moderator'],
        application: dm,
        status: 'closed',
        theme: 'gaming',
        published: 40,
      }),
    ),
    // Published, but past its date: out of the feed, still readable by its link.
    make(
      6,
      guildPost(G.cubelands, U.alex, {
        title: 'Équipe de modération : saison 5',
        description: 'Recrutement de la saison 5, clos depuis plusieurs jours. Les candidatures ne sont plus étudiées.',
        positions: ['moderator', 'support'],
        application: url('https://forms.example.com/saison-5'),
        expires_at: ago(5),
        theme: 'gaming',
        published: 30,
      }),
    ),

    // ---- Moddy ---------------------------------------------------------------------------------------------
    make(
      7,
      guildPost(G.moddy, U.noe, {
        title: "Rejoindre l'équipe de support de Moddy",
        description:
          "Le serveur Moddy cherche des personnes pour répondre aux questions des utilisateurs du bot : configuration, permissions, problèmes courants. Vous êtes formé aux commandes et vous avez accès à une documentation interne.\n\nNous préférons quelqu'un de régulier à quelqu'un de très disponible un mois puis absent.",
        positions: ['support', 'community_manager'],
        requirements: [requirement('languages', ['fr', 'en']), requirement('experience_months', 6)],
        application: url('https://forms.example.com/moddy-support'),
        languages: ['fr', 'en'],
        timezone: 'Europe/Paris',
        commitment: commit(8, 'volunteer', 3),
        theme: 'tech',
        tags: ['support', 'bot'],
        published: 3,
      }),
    ),

    // ---- Atelier du Phénix (Camille, the `member` persona): five live posts, so the quota is full ---------
    make(
      8,
      guildPost(G.atelier, U.camille, {
        title: "Modérateurs pour la saison 4 du royaume d'Ellandre",
        description:
          "L'Atelier du Phénix ouvre sa quatrième saison et cherche des modérateurs qui connaissent le jeu de rôle textuel. Vous veillez au respect du règlement pendant les sessions, vous accompagnez les nouveaux joueurs et vous remontez les situations difficiles à l'équipe.\n\nUne expérience vérifiée sur Lineup est demandée.",
        positions: ['moderator'],
        requirements: [
          requirement('verified_experience', null, {verified_by_lineup: true}),
          requirement('voice_required', true),
          requirement('languages', ['fr']),
        ],
        application: url('https://atelier-phenix.example.com/recrutement'),
        timezone: 'Europe/Paris',
        commitment: commit(5, 'volunteer', 2),
        theme: 'roleplay',
        tags: ['jdr', 'fantasy', 'moderation'],
        published: 5,
      }),
    ),
    make(
      9,
      guildPost(G.atelier, U.camille, {
        title: 'Maître du jeu pour les sessions du mardi',
        description:
          'Nous cherchons une personne pour mener les sessions du mardi soir : préparer les scénarios, arbitrer les règles et faire vivre les personnages non joueurs. Aucune expérience de serveur n’est exigée, mais il faut aimer raconter.',
        positions: ['other'],
        positions_other: ['Maître du jeu', 'Narrateur'],
        requirements: [requirement('server_activity', 'Être présent sur le serveur depuis au moins un mois')],
        application: dm,
        commitment: commit(4, 'volunteer', 1),
        theme: 'roleplay',
        tags: ['jdr', 'narration'],
        published: 9,
      }),
    ),
    make(
      10,
      guildPost(G.atelier, U.camille, {
        title: 'Responsable du lore et de la documentation',
        description:
          "Le royaume d'Ellandre a trois ans d'histoire et un wiki qui a besoin d'être relu et organisé. Vous centralisez les nouveautés de chaque saison et vous aidez les joueurs à garder leurs personnages cohérents.",
        positions: ['manager', 'communication'],
        requirements: [requirement('experience_months', 6)],
        application: url('https://atelier-phenix.example.com/recrutement'),
        commitment: commit(6, 'volunteer', 1),
        theme: 'roleplay',
        tags: ['lore', 'wiki'],
        published: 12,
      }),
    ),
    make(
      11,
      guildPost(G.atelier, U.camille, {
        title: 'Animateur pour les événements communautaires',
        description:
          "Soirées thématiques, concours d'écriture, tournois de dés : nous cherchons quelqu'un pour proposer et animer un événement par mois en dehors des sessions de jeu.",
        positions: ['event_animator'],
        application: dm,
        commitment: commit(3, 'volunteer', 1),
        theme: 'roleplay',
        tags: ['evenements'],
        published: 15,
      }),
    ),
    make(
      12,
      guildPost(G.atelier, U.camille, {
        title: 'Modérateur de nuit (créneau 23h à 3h)',
        description:
          "Notre équipe est surtout active en soirée. Nous cherchons une personne couvrant le créneau tardif, principalement pour répondre aux signalements et accueillir les joueurs d'autres fuseaux horaires.",
        positions: ['moderator'],
        requirements: [requirement('availability_hours', 8)],
        application: dm,
        timezone: 'UTC+01:00',
        commitment: commit(8, 'volunteer', 1),
        theme: 'roleplay',
        tags: ['nuit', 'moderation'],
        published: 18,
      }),
    ),
    make(
      13,
      guildPost(G.atelier, U.camille, {
        title: 'Community manager pour les réseaux sociaux',
        description:
          "Brouillon : l'Atelier souhaite ouvrir un poste pour gérer ses comptes sur les réseaux sociaux et relayer les nouvelles saisons.",
        positions: ['community_manager', 'communication'],
        status: 'draft',
        theme: 'roleplay',
      }),
    ),
    make(
      14,
      guildPost(G.atelier, U.camille, {
        title: "Recherche d'un modérateur supplémentaire",
        description:
          "Poste pourvu depuis la saison 3. Nous gardons l'annonce fermée pour référence et nous la rouvrirons à la prochaine vague de recrutement.",
        positions: ['moderator'],
        application: url('https://atelier-phenix.example.com/recrutement'),
        status: 'closed',
        theme: 'roleplay',
        published: 60,
      }),
    ),
    // Hidden by the staff: the author reads the reason, nobody else sees the post.
    make(
      15,
      guildPost(G.atelier, U.camille, {
        title: 'Recrutement staff : avantages exclusifs',
        description:
          'Rejoignez notre équipe de modération et profitez de nombreux avantages exclusifs réservés au staff, accessibles après un premier versement.',
        positions: ['moderator', 'manager'],
        application: dm,
        status: 'hidden',
        hidden_reason:
          "Cette annonce demande un versement avant tout entretien. Ce n'est pas autorisé sur Lineup. Reformulez-la sans contrepartie financière, puis republiez-la.",
        theme: 'roleplay',
        published: 20,
      }),
    ),

    // ---- Pixel Forge (Camille manages it too) --------------------------------------------------------------
    make(
      16,
      guildPost(G.pixel, U.camille, {
        title: 'Community moderators for a 2,700-member game dev server',
        description:
          'Pixel Forge is looking for two moderators to help keep feedback threads constructive and the showcase channel tidy. You will work with the current team, follow a short written guide and escalate anything unclear to the admins.\n\nWe are in several time zones, so evenings in Europe and North America are the most useful.',
        positions: ['moderator'],
        requirements: [
          requirement('languages', ['en']),
          requirement('account_age_days', 90, {verified_by_lineup: true}),
        ],
        application: url('https://pixelforge.example.com/apply'),
        languages: ['en', 'fr'],
        timezone: 'UTC+00:00',
        commitment: commit(4, 'volunteer', 2),
        theme: 'tech',
        tags: ['gamedev', 'indie', 'moderation'],
        published: 7,
      }),
    ),
    make(
      17,
      guildPost(G.pixel, U.camille, {
        title: 'Developer relations volunteer',
        description:
          'We want someone who enjoys explaining things to run our weekly office hours and keep the resources channel up to date. Experience with Godot, Unity or Unreal is a plus; being kind is the requirement.',
        positions: ['developer', 'communication'],
        requirements: [requirement('experience_months', 12)],
        application: dm,
        languages: ['en'],
        commitment: commit(3, 'volunteer', 1),
        theme: 'tech',
        tags: ['godot', 'devrel'],
        published: 11,
      }),
    ),
    make(
      18,
      guildPost(G.pixel, U.camille, {
        title: 'Game jam organiser',
        description:
          'Draft: someone to coordinate our next quarterly game jam, from theme voting to the closing stream.',
        positions: ['event_animator'],
        languages: ['en'],
        status: 'draft',
        theme: 'tech',
      }),
    ),

    // ---- Anime Plaza (Amira) -------------------------------------------------------------------------------
    make(
      19,
      guildPost(G.anime, U.amira, {
        title: "Équipe de modération : saison d'hiver",
        description:
          "Anime Plaza renforce son équipe pour la saison d'hiver : les simulcasts remplissent les salons et nous voulons des modérateurs actifs pendant les watch parties du week-end. Vous suivez une formation, puis vous êtes accompagné pendant un mois.",
        positions: ['moderator', 'event_animator'],
        requirements: [requirement('min_age', 18, {verified_by_lineup: true}), requirement('languages', ['fr', 'en'])],
        application: url('https://animeplaza.example.com/staff'),
        languages: ['fr', 'en'],
        timezone: 'Europe/Paris',
        commitment: commit(8, 'volunteer', 3),
        theme: 'anime',
        tags: ['anime', 'watchparty'],
        published: 1,
      }),
    ),
    make(
      20,
      guildPost(G.anime, U.amira, {
        title: 'Responsable partenariats',
        description:
          "Nous cherchons une personne pour contacter des studios, des éditeurs et d'autres serveurs, négocier les collaborations et suivre les contreparties. Une première expérience dans la communication ou le commerce est un vrai plus.",
        positions: ['partnership_manager'],
        requirements: [requirement('experience_months', 12)],
        application: dm,
        commitment: commit(10, 'negotiable', 1),
        theme: 'anime',
        tags: ['partenariats'],
        published: 8,
      }),
    ),

    // ---- NSFW servers (filtered out of the feed unless `include_nsfw`) --------------------------------------
    make(
      21,
      guildPost(G.velvet, U.jonas, {
        title: 'Modérateurs (18 ans minimum)',
        description:
          'Velvet Lounge est un serveur réservé aux adultes. Nous cherchons des modérateurs calmes, attentifs au consentement et à la vie privée des membres, et capables de faire respecter un règlement strict sans en faire trop.',
        positions: ['moderator'],
        requirements: [requirement('min_age', 18, {verified_by_lineup: true})],
        application: dm,
        commitment: commit(5, 'volunteer', 2),
        theme: 'nsfw',
        tags: ['18plus'],
        published: 3,
      }),
    ),
    make(
      22,
      guildPost(G.nox, U.karim, {
        title: 'Équipe de modération de nuit',
        description:
          'Nox After Dark est ouvert tard et les soirées vocales finissent souvent après minuit. Nous cherchons des modérateurs pour la nuit, majeurs, avec une bonne maîtrise des outils de modération.',
        positions: ['moderator', 'support'],
        requirements: [requirement('min_age', 18)],
        application: url('https://forms.example.com/nox'),
        commitment: commit(6, 'volunteer', 2),
        theme: 'community',
        tags: ['nuit', 'vocal'],
        published: 5,
      }),
    ),

    // ---- An unlisted server: its posts are not in the feed, and 404 for a visitor --------------------------
    make(
      23,
      guildPost(G.hyrule, U.leo, {
        title: 'Modérateurs pour un serveur RP Zelda',
        description:
          "Nous préparons l'ouverture d'un serveur de jeu de rôle autour de Zelda et nous cherchons des modérateurs pour la phase de test. Le profil n'est pas encore listé dans l'annuaire.",
        positions: ['moderator'],
        application: dm,
        theme: 'roleplay',
        tags: ['zelda', 'rp'],
        published: 4,
      }),
    ),
    make(
      24,
      guildPost(G.hyrule, U.leo, {
        title: 'Graphiste pour cartes et illustrations',
        description:
          'Nous avons besoin de cartes du royaume et de quelques illustrations de personnages pour accompagner la bêta. Travail rémunéré à la pièce.',
        positions: ['graphic_designer'],
        application: dm,
        commitment: commit(null, 'paid', 1),
        theme: 'roleplay',
        published: 10,
      }),
    ),

    // ---- A suspended server (global ban): out of every list, 404 by link -----------------------------------
    make(
      25,
      guildPost(G.trade, U.recrut, {
        title: 'Devenez modérateur et gagnez 500 € par semaine',
        description:
          'Aucune expérience requise, travail depuis chez vous, paiement chaque semaine. Contactez-nous en privé pour recevoir vos accès.',
        positions: ['moderator'],
        application: dm,
        commitment: commit(2, 'paid', 20),
        theme: 'other',
        published: 22,
      }),
    ),
    make(
      26,
      guildPost(G.trade, U.recrut, {
        title: 'Community manager rémunéré en cryptomonnaies',
        description:
          'Rejoignez notre équipe et recevez une part des profits du groupe. Un dépôt de départ est demandé pour activer votre compte staff.',
        positions: ['community_manager'],
        application: dm,
        theme: 'other',
        published: 25,
      }),
    ),

    // ---- Other servers --------------------------------------------------------------------------------------
    make(
      27,
      guildPost(G.lumen, U.theo, {
        title: "Tuteurs bénévoles pour l'aide aux devoirs",
        description:
          "Lumen Study accompagne des lycéens et des étudiants de première année. Nous cherchons des tuteurs en mathématiques, en français et en physique-chimie pour répondre aux questions dans les salons d'entraide, quelques soirs par semaine.",
        positions: ['support'],
        requirements: [requirement('server_activity', 'Avoir déjà aidé des élèves, même informellement')],
        application: url('https://forms.example.com/lumen-tutorat'),
        timezone: 'Europe/Paris',
        commitment: commit(3, 'volunteer', 6),
        theme: 'education',
        tags: ['etudes', 'tutorat'],
        published: 6,
      }),
    ),
    make(
      28,
      guildPost(G.devcorner, U.leo, {
        title: 'Mainteneurs de bots communautaires',
        description:
          'Dev Corner héberge quelques bots open source utilisés par plusieurs serveurs. Nous cherchons des mainteneurs pour relire les contributions, trier les tickets et publier des versions. TypeScript et discord.js de préférence.',
        positions: ['developer'],
        requirements: [requirement('experience_months', 12), requirement('languages', ['fr', 'en'])],
        application: url('https://github.com/leo-vsr-example/community-bots'),
        languages: ['fr', 'en'],
        commitment: commit(4, 'volunteer', 3),
        theme: 'tech',
        tags: ['typescript', 'open-source'],
        published: 9,
      }),
    ),
    make(
      29,
      guildPost(G.arena, U.karim, {
        title: 'Casteur et animateur de tournois',
        description:
          "Arena Esport FR diffuse ses finales chaque dimanche. Nous cherchons des casteurs pour commenter les matchs et des animateurs pour présenter le programme. Une première expérience à l'antenne est bienvenue, un bon micro est indispensable.",
        positions: ['event_animator', 'communication'],
        requirements: [requirement('voice_required', true)],
        application: url('https://arena-esport.example.com/staff'),
        commitment: commit(6, 'negotiable', 2),
        theme: 'esport',
        tags: ['cast', 'valorant'],
        published: 2,
      }),
    ),
    make(
      30,
      guildPost(G.arena, U.karim, {
        title: "Manager d'équipe amateur",
        description:
          "Nos équipes amateurs ont besoin d'un référent : organiser les entraînements, suivre les disponibilités et servir de lien avec le staff. Une bonne connaissance de la scène compétitive francophone aide beaucoup.",
        positions: ['manager'],
        application: dm,
        commitment: commit(5, 'volunteer', 2),
        theme: 'esport',
        tags: ['management', 'esport'],
        published: 13,
      }),
    ),

    // ---- Personal posts -------------------------------------------------------------------------------------
    // Camille: two live (the third place of her quota is free), a draft, a closed one, an expired one.
    make(
      31,
      userPost(U.camille, {
        title: 'Modératrice expérimentée cherche une équipe RP',
        description:
          "Quatre ans de modération sur des serveurs de jeu de rôle, dont deux comme fondatrice. Je cherche à rejoindre une équipe plutôt qu'à en diriger une : j'aime les environnements où l'on se relit et où l'on se forme ensemble.\n\nDisponible en soirée et le dimanche.",
        positions: ['moderator', 'community_manager'],
        requirements: [],
        application: dm,
        languages: ['fr', 'en'],
        timezone: 'Europe/Paris',
        commitment: commit(10, 'volunteer', null),
        theme: 'roleplay',
        tags: ['rp', 'moderation'],
        featured_experience_id: experienceId(2),
        published: 3,
      }),
    ),
    make(
      32,
      userPost(U.camille, {
        title: 'Disponible pour de la modération en anglais, soirs et week-ends',
        description:
          'Je modère déjà un serveur anglophone de développeurs de jeux. Je peux rejoindre une équipe pour les créneaux de soirée en Europe.',
        positions: ['moderator'],
        languages: ['en', 'fr'],
        timezone: 'Europe/Paris',
        commitment: commit(6, 'volunteer', null),
        tags: ['english'],
        expires_at: from(45),
        published: 8,
      }),
    ),
    make(
      33,
      userPost(U.camille, {
        title: "Community manager, quatre ans d'expérience",
        description:
          "Brouillon : animation de communautés de jeu de rôle, calendrier d'événements, accueil des nouveaux membres et rédaction d'annonces.",
        positions: ['community_manager'],
        status: 'draft',
      }),
    ),
    make(
      34,
      userPost(U.camille, {
        title: 'Recherche un serveur anime',
        description:
          "J'ai trouvé une équipe, merci à celles et ceux qui m'ont écrit. L'annonce reste ici pour mémoire.",
        positions: ['moderator', 'event_animator'],
        status: 'closed',
        published: 50,
      }),
    ),
    make(
      35,
      userPost(U.camille, {
        title: 'Animatrice de soirées jeux, disponible ce mois-ci',
        description:
          'Annonce ponctuelle pour la période des fêtes. Je peux animer des soirées jeux de société en vocal.',
        positions: ['event_animator'],
        expires_at: ago(2),
        published: 25,
      }),
    ),
    // Others.
    make(
      36,
      userPost(U.sam, {
        title: 'Experienced moderator available (EN, UTC)',
        description:
          'Five years of moderation on communities of 10,000+ members. I can write escalation guides, train new moderators and cover the evening hours in UTC. I am looking for one team to settle with, not several side projects.',
        positions: ['moderator'],
        requirements: [],
        application: dm,
        languages: ['en', 'fr'],
        timezone: 'Europe/London',
        commitment: commit(12, 'volunteer', null),
        tags: ['english', 'training'],
        featured_experience_id: experienceId(16),
        published: 5,
      }),
    ),
    make(
      37,
      userPost(U.leo, {
        title: 'Développeur de bots Discord (discord.js), disponible pour un projet',
        description:
          "Je développe des bots de tickets, de niveaux et d'automodération. Je peux reprendre un bot existant ou en créer un sur mesure, avec hébergement et documentation pour l'équipe.",
        positions: ['developer', 'other'],
        positions_other: ['Intégrations API'],
        application: dm,
        languages: ['fr', 'en'],
        commitment: commit(8, 'paid', null),
        theme: 'tech',
        tags: ['discord-js', 'typescript', 'automod'],
        featured_experience_id: experienceId(19),
        published: 7,
      }),
    ),
    make(
      38,
      userPost(U.lucie, {
        title: 'Community manager cherche communauté gaming',
        description:
          "Je gère le calendrier d'événements et les annonces de plusieurs serveurs. Je cherche une communauté gaming qui a besoin de structurer son animation, avec une personne à qui rendre des comptes.",
        positions: ['community_manager', 'event_animator'],
        application: dm,
        timezone: 'Europe/Brussels',
        commitment: commit(8, 'negotiable', null),
        tags: ['gaming', 'animation'],
        published: 10,
      }),
    ),
    make(
      39,
      userPost(U.theo, {
        title: "Animateur d'événements, deux ans d'expérience",
        description:
          "Quiz, soirées jeux, blind tests et tournois amicaux : j'anime des événements en vocal pour des communautés de taille moyenne. Je peux m'occuper de toute l'organisation, de l'annonce à la remise des lots.",
        positions: ['event_animator'],
        requirements: [],
        application: dm,
        commitment: commit(6, 'volunteer', null),
        tags: ['quiz', 'vocal'],
        published: 14,
      }),
    ),
    make(
      40,
      userPost(U.jonas, {
        title: 'Moderator mit drei Jahren Erfahrung (DE/EN)',
        description:
          'Ich suche ein deutschsprachiges Team, das Moderation ernst nimmt. Ich bringe Erfahrung mit Regelwerken, Ticket-Systemen und Konfliktlösung mit und kann abends sowie am Wochenende arbeiten.',
        positions: ['moderator'],
        application: dm,
        languages: ['de', 'en'],
        timezone: 'Europe/Berlin',
        commitment: commit(10, 'volunteer', null),
        tags: ['deutsch'],
        published: 1,
      }),
    ),
    make(
      41,
      userPost(U.hugo, {
        title: 'Modérateur vocal, créneaux de semaine',
        description:
          "J'ai trouvé un créneau qui me convient chez Cubelands. L'annonce est fermée mais reste visible pour mon historique.",
        positions: ['moderator'],
        status: 'closed',
        published: 35,
      }),
    ),
    make(
      42,
      userPost(U.marta, {
        title: 'Suporte e moderação em português',
        description:
          'Disponível para apoiar comunidades lusófonas com moderação e atendimento. Posso trabalhar de manhã e à noite.',
        positions: ['support', 'moderator'],
        languages: ['pt'],
        status: 'hidden',
        hidden_reason:
          'Annonce en double : une annonce identique est déjà en ligne. Fermez-la ou supprimez-la, puis republiez celle qui reste.',
        published: 12,
      }),
    ),
    make(
      43,
      userPost(U.dylan, {
        title: 'Modérateur disponible en soirée',
        description: 'Deux ans de modération sur des serveurs de jeux. Je peux commencer rapidement.',
        positions: ['moderator'],
        application: dm,
        published: 15,
      }),
    ),
    make(
      44,
      userPost(U.dylan, {
        title: 'Recherche une équipe de modération',
        description: 'Brouillon en cours de rédaction.',
        positions: ['moderator'],
        status: 'draft',
      }),
    ),
    // Alex has a `lineup_verified` badge: a personal post by a verified account, visible in the feed.
    make(
      45,
      userPost(U.alex, {
        title: 'Fondateur de serveur, disponible pour conseiller une équipe de modération',
        description:
          "J'ai monté et animé un serveur de développement de jeux de 2 700 membres. Je peux aider une équipe à structurer sa modération : règlement, rôles, procédure de sanction, formation des nouveaux.\n\nMissions courtes de préférence.",
        positions: ['community_manager', 'moderator'],
        application: dm,
        languages: ['fr', 'en'],
        timezone: 'Europe/Paris',
        commitment: commit(5, 'negotiable', null),
        theme: 'tech',
        tags: ['moderation', 'formation'],
        published: 4,
      }),
    ),
  ];
}

const FILLER_TITLES = [
  'Gagnez de l’argent en modérant depuis votre canapé',
  'Staff recherché : paiement immédiat',
  'Devenez administrateur rémunéré, places limitées',
  'Opportunité unique pour community managers',
];

/**
 * A banned account's posts (still `published`, in the database): they are
 * removed from the feed AFTER the page is read. Placed between two real
 * posts, there are enough of them (`count`) that one whole page of the feed
 * is empty and still carries a cursor — the case the front must follow
 * (LINEUP.md §0). `newest` is the publication time of the first filler;
 * each next one is `step` older.
 */
export function seedFillerPosts(count: number, newest: number, step = MINUTE): DbPost[] {
  return Array.from({length: count}, (_, index) => {
    const publishedAt = iso(newest - index * step);
    return {
      id: fillerPostId(index + 1),
      kind: 'user' as const,
      guild_id: null,
      author_id: U.recrut,
      title: `${FILLER_TITLES[index % FILLER_TITLES.length]} (${index + 1})`,
      description: 'Contactez-nous en privé pour recevoir les détails et vos accès. Aucune expérience nécessaire.',
      positions: ['moderator'],
      positions_other: [],
      requirements: [],
      application: {type: 'discord_dm' as const, url: null},
      languages: ['fr'],
      timezone: null,
      commitment: null,
      theme: null,
      tags: [],
      featured_experience_id: null,
      status: 'published' as const,
      hidden_reason: null,
      expires_at: null,
      published_at: publishedAt,
      created_at: iso(newest - index * step - 5 * MINUTE),
      updated_at: publishedAt,
    };
  });
}
