/** Reports in every status, and the manual badges the staff granted. */

import type {ManualBadgeGrant, Report} from '@/api/types';

import {DAY, HOUR, iso} from '../time';
import {G, postId, reportId, U} from './ids';

export function seedReports(now: Date): Report[] {
  const ago = (hours: number) => iso(now.getTime() - hours * HOUR);
  const report = (
    n: number,
    seed: Pick<Report, 'target_type' | 'target_id' | 'reporter_id' | 'reason'> & Partial<Report>,
    hoursAgo: number,
  ): Report => ({
    id: reportId(n),
    details: null,
    status: 'open',
    handled_by: null,
    created_at: ago(hoursAgo),
    ...seed,
  });
  return [
    report(1, {
      target_type: 'post',
      target_id: postId(25),
      reporter_id: U.sam,
      reason: 'scam',
      details: "L'annonce promet 500 € par semaine sans expérience et demande de passer en message privé pour recevoir des accès.",
    }, 3),
    report(2, {
      target_type: 'user',
      target_id: U.recrut,
      reporter_id: U.lucie,
      reason: 'spam',
      details: 'Même message envoyé dans plusieurs serveurs de modération.',
    }, 8),
    report(3, {
      target_type: 'post',
      target_id: postId(26),
      reporter_id: U.camille,
      reason: 'scam',
      details: "Un dépôt de départ est demandé pour activer le compte staff : c'est une arnaque.",
    }, 20),
    report(4, {
      target_type: 'guild',
      target_id: G.nox,
      reporter_id: U.theo,
      reason: 'inappropriate',
      details: "Le serveur recrute des modérateurs en affichant des visuels qui n'ont pas leur place dans une annonce publique.",
    }, 30),
    report(5, {
      target_type: 'post',
      target_id: postId(23),
      reporter_id: U.jonas,
      reason: 'other',
    }, 52),
    report(6, {
      target_type: 'post',
      target_id: postId(42),
      reporter_id: U.sam,
      reason: 'spam',
      details: 'Annonce publiée deux fois.',
      status: 'resolved',
      handled_by: U.noe,
    }, 90),
    report(7, {
      target_type: 'guild',
      target_id: G.velvet,
      reporter_id: U.hugo,
      reason: 'inappropriate',
      status: 'dismissed',
      handled_by: U.noe,
    }, 120),
    report(8, {
      target_type: 'user',
      target_id: U.dylan,
      reporter_id: U.amira,
      reason: 'impersonation',
      details: "Cette personne se présente comme modérateur d'Anime Plaza, ce qu'il n'est pas.",
      status: 'resolved',
      handled_by: U.noe,
    }, 200),
  ];
}

export function seedBadgeGrants(now: Date): ManualBadgeGrant[] {
  const ago = (days: number) => iso(now.getTime() - days * DAY);
  const grant = (
    entity_type: 'user' | 'guild',
    entity_id: string,
    badge: string,
    days: number,
    note: string | null,
  ): ManualBadgeGrant => ({entity_type, entity_id, badge, granted_by: U.noe, granted_at: ago(days), note});
  return [
    grant('guild', G.moddy, 'moddy_server', 400, 'Serveur officiel'),
    grant('guild', G.moddy, 'lineup_verified', 400, null),
    grant('guild', G.anime, 'moddy_partner', 120, 'Partenariat signé'),
    grant('guild', G.cubelands, 'lineup_verified', 60, 'Équipe et propriétaire vérifiés'),
    grant('user', U.alex, 'lineup_verified', 60, null),
    grant('user', U.amira, 'moddy_partner', 90, 'Collaboration sur les annonces de partenariat'),
  ];
}
