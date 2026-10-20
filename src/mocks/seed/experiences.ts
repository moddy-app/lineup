/**
 * Experiences in every verification status, with the proof the owner sees:
 * verified by Discord (permissions, owner, role count), verified by the staff
 * (note), pending (review note), rejected (reason), unverified; on servers and
 * on services; current and ended.
 */

import type {VerificationEvidence} from '@/api/types';

import type {DbExperience} from '../model';
import {DAY, iso} from '../time';
import {experienceId as xid, G, U} from './ids';

type ExperienceSeed = Pick<DbExperience, 'user_id' | 'kind' | 'name' | 'position' | 'start_date'> & Partial<DbExperience>;

export function seedExperiences(now: Date): DbExperience[] {
  const ago = (days: number) => iso(now.getTime() - days * DAY);
  const lastOrder = new Map<string, number>();

  const make = (seed: ExperienceSeed, n: number, createdDaysAgo = 120): DbExperience => {
    const index = lastOrder.get(seed.user_id) ?? 0;
    lastOrder.set(seed.user_id, index + 1);
    return {
      id: xid(n),
      guild_id: null,
      invite_code: null,
      position_other: null,
      description: null,
      end_date: null,
      status: 'unverified',
      method: null,
      evidence: null,
      verified_at: null,
      verified_by: null,
      rejection_reason: null,
      sort_index: index,
      created_at: ago(createdDaysAgo),
      updated_at: ago(createdDaysAgo),
      ...seed,
    };
  };

  const oauth = (
    daysAgo: number,
    permissions: string[],
    owner: boolean,
    roleCount: number,
  ): Pick<DbExperience, 'status' | 'method' | 'verified_at' | 'evidence' | 'updated_at'> => ({
    status: 'verified',
    method: 'discord_oauth',
    verified_at: ago(daysAgo),
    evidence: {permissions, owner, role_count: roleCount, checked_at: ago(daysAgo)},
    updated_at: ago(daysAgo),
  });

  const guild = (
    user_id: string,
    guild_id: string,
    name: string,
    invite_code: string,
    position: string,
    start_date: string,
    extra: Partial<DbExperience> = {},
  ): ExperienceSeed => ({user_id, kind: 'guild', guild_id, invite_code, name, position, start_date, ...extra});

  const service = (
    user_id: string,
    name: string,
    position: string,
    start_date: string,
    end_date: string | null,
    extra: Partial<DbExperience> = {},
  ): ExperienceSeed => ({user_id, kind: 'service', name, position, start_date, end_date, ...extra});

  const staffNote: VerificationEvidence = {
    staff_note: "Message du propriétaire du serveur confirmé en privé.",
    verified_at_by_staff: ago(30),
  };

  return [
    // ---- Camille (the `member` persona): one of each --------------------------------------------------------
    make(
      guild(U.camille, G.atelier, 'Atelier du Phénix', 'atelier-phenix', 'admin', '2022-06-03', {
        description: "Fondatrice. Gestion de l'équipe de modération, recrutement et animation des sessions.",
        ...oauth(60, ['ADMINISTRATOR'], true, 6),
      }),
      1,
    ),
    make(
      guild(U.camille, G.pixel, 'Pixel Forge', 'pixelforge', 'community_manager', '2023-02-01', {
        description: 'Animation du serveur, organisation des game jams trimestrielles.',
        ...oauth(45, ['ADMINISTRATOR'], false, 5),
      }),
      2,
    ),
    // Would succeed automatically: she holds MANAGE_MESSAGES and MODERATE_MEMBERS there.
    make(
      guild(U.camille, G.cubelands, 'Cubelands FR', 'cubelands', 'moderator', '2024-03-01', {
        description: 'Modération du texte et du vocal, gestion des tickets.',
      }),
      3,
      20,
    ),
    // Would fail: a member, but with no staff permission.
    make(guild(U.camille, G.anime, 'Anime Plaza', 'animeplaza', 'event_animator', '2025-01-10'), 4, 15),
    // Would fail: not a member of this server.
    make(guild(U.camille, G.lumiere, 'Lumière Studio', 'lumiere', 'graphic_designer', '2024-09-01'), 5, 10),
    // Pending a review (a past experience on a service): the owner sees her own note.
    make(
      service(U.camille, 'Chaîne Twitch de Kaelis', 'moderator', '2021-04-12', '2023-06-30', {
        description: 'Modération du chat pendant les directs, environ 800 spectateurs en moyenne.',
        status: 'pending',
        evidence: {
          review_note: "Lien du compte : twitch.tv/kaelis (exemple). Je peux fournir une capture de la liste des modérateurs.",
          requested_at: ago(2),
        },
        updated_at: ago(2),
      }),
      6,
    ),
    // Rejected, with the reason the staff gave.
    make(
      service(U.camille, 'Forum Les Cartographes', 'manager', '2019-09-01', '2021-03-31', {
        status: 'rejected',
        verified_by: U.noe,
        rejection_reason:
          "Nous n'avons pas pu confirmer l'existence de cette communauté. Ajoutez un lien vers une page ou un message qui montre votre rôle, puis redemandez une revue.",
        evidence: {review_note: 'Forum fermé depuis, désolée.', requested_at: ago(14)},
        updated_at: ago(9),
      }),
      7,
    ),
    // Verified by the staff, and over: a past server.
    make(
      guild(U.camille, G.corbeau, 'Guilde du Corbeau', 'corbeau-guilde', 'other', '2023-05-01', {
        end_date: '2024-02-29',
        position_other: 'Capitaine de roster',
        status: 'verified',
        method: 'moddy_staff',
        verified_at: ago(30),
        verified_by: U.noe,
        evidence: staffNote,
        updated_at: ago(30),
      }),
      8,
    ),
    // Unverified and current, on a server she owns (the automatic check would succeed: she is the owner).
    make(guild(U.camille, G.cafe, 'Café des Mods', 'cafe-des-mods', 'admin', '2025-05-20'), 9, 5),

    // ---- The teams of the servers (verified, current) -------------------------------------------------------
    make(guild(U.alex, G.cubelands, 'Cubelands FR', 'cubelands', 'admin', '2021-02-14', oauth(100, ['ADMINISTRATOR'], true, 9)), 10),
    make(
      guild(
        U.hugo,
        G.cubelands,
        'Cubelands FR',
        'cubelands',
        'moderator',
        '2023-05-08',
        oauth(80, ['MANAGE_MESSAGES', 'KICK_MEMBERS'], false, 3),
      ),
      11,
    ),
    make(
      guild(
        U.lucie,
        G.cubelands,
        'Cubelands FR',
        'cubelands',
        'community_manager',
        '2024-01-15',
        oauth(70, ['MANAGE_MESSAGES', 'MANAGE_EVENTS'], false, 3),
      ),
      12,
    ),
    // A suspended account never appears in a team, whatever its experiences.
    make(guild(U.dylan, G.cubelands, 'Cubelands FR', 'cubelands', 'moderator', '2022-09-01', oauth(150, ['MANAGE_MESSAGES'], false, 2)), 13),
    make(
      guild(U.noe, G.moddy, 'Moddy', 'moddy', 'support', '2023-11-20', {
        status: 'verified',
        method: 'moddy_staff',
        verified_at: ago(200),
        verified_by: U.noe,
        evidence: {staff_note: 'Membre de l’équipe Moddy.', verified_at_by_staff: ago(200)},
        updated_at: ago(200),
      }),
      14,
    ),
    make(guild(U.amira, G.anime, 'Anime Plaza', 'animeplaza', 'partnership_manager', '2020-01-12', oauth(90, ['ADMINISTRATOR'], false, 7)), 15),
    make(
      guild(
        U.sam,
        G.anime,
        'Anime Plaza',
        'animeplaza',
        'moderator',
        '2022-03-01',
        oauth(60, ['MODERATE_MEMBERS', 'KICK_MEMBERS'], false, 4),
      ),
      16,
    ),
    make(guild(U.emma, G.pixel, 'Pixel Forge', 'pixelforge', 'admin', '2020-11-08', oauth(110, ['ADMINISTRATOR'], true, 6)), 17),
    make(guild(U.karim, G.arena, 'Arena Esport FR', 'arena-esport', 'manager', '2021-05-05', oauth(75, ['ADMINISTRATOR'], true, 8)), 18),
    make(guild(U.leo, G.devcorner, 'Dev Corner', 'devcorner', 'developer', '2021-07-27', oauth(55, ['ADMINISTRATOR'], true, 4)), 19),
    // Sam: a past service, verified, shown to everyone.
    make(
      service(U.sam, 'Réseau de serveurs StreamHub', 'moderator', '2019-10-01', '2022-02-28', {
        status: 'verified',
        method: 'moddy_staff',
        verified_at: ago(140),
        verified_by: U.noe,
        evidence: {staff_note: 'Confirmé par le responsable du réseau.', verified_at_by_staff: ago(140)},
        updated_at: ago(140),
      }),
      20,
    ),
    // Jonas: one pending (a visitor sees it as unverified) and one rejected (a visitor does not see it).
    make(
      service(U.jonas, 'Forum Spielwelt', 'moderator', '2022-01-10', '2024-04-30', {
        status: 'pending',
        evidence: {requested_at: ago(4)},
        updated_at: ago(4),
      }),
      21,
    ),
    make(
      service(U.jonas, 'Clan Nachtwache', 'admin', '2020-05-01', '2021-12-31', {
        status: 'rejected',
        verified_by: U.noe,
        rejection_reason: "Le clan n'a pas pu être confirmé. Indiquez un moyen de contacter un ancien membre de l'équipe.",
        updated_at: ago(20),
      }),
      22,
    ),
    // A person with a pending review nobody has looked at yet, to fill the staff queue.
    make(
      service(U.lucie, 'Association Jeux en Bibliothèque', 'event_animator', '2022-09-01', '2023-12-15', {
        description: "Animation d'ateliers jeux de société en médiathèque.",
        status: 'pending',
        evidence: {review_note: "La responsable de l'association peut confirmer par e-mail.", requested_at: ago(8)},
        updated_at: ago(8),
      }),
      23,
    ),
    make(
      guild(U.theo, G.lumen, 'Lumen Study', 'lumen-study', 'admin', '2023-03-06', {
        status: 'pending',
        evidence: {requested_at: ago(1)},
        updated_at: ago(1),
      }),
      24,
    ),
    make(
      guild(U.hugo, G.arena, 'Arena Esport FR', 'arena-esport', 'event_animator', '2022-02-01', {
        end_date: '2023-04-30',
        description: 'Animation de tournois amateurs.',
      }),
      25,
    ),
  ];
}
