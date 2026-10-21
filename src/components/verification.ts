/**
 * The verification mark shown next to a name (docs/ui-redesign.md, "Badge de
 * vérification"). One mark, three meanings, picked from the badges of the
 * server or the person.
 */

import type {Badge} from '@/api/types';

import type {ComponentsT} from './componentsT';

export type Verification = 'moddy_staff' | 'moddy_server' | 'lineup_verified';
export type VerificationEntity = 'user' | 'guild';

/** The badge ids that mean a verification, by priority. */
export const VERIFICATION_BADGE_IDS: readonly Verification[] = ['moddy_staff', 'moddy_server', 'lineup_verified'];

/** Per kind of entity, the verifications that can apply to it, best first. */
const PRIORITY: Readonly<Record<VerificationEntity, readonly Verification[]>> = {
  user: ['moddy_staff', 'lineup_verified'],
  guild: ['moddy_server', 'lineup_verified'],
};

/**
 * The verification of a server or a person, or null. Priority: 1. Moddy team
 * (a person), 2. official Moddy server (a server), 3. verified by Lineup.
 * `badges` may be missing (summaries do not always carry them): null then.
 */
export function verificationOf(
  badges: readonly Badge[] | undefined | null,
  entity: VerificationEntity,
): Verification | null {
  if (!badges || badges.length === 0) return null;
  const ids = new Set(badges.map((badge) => badge.id));
  return PRIORITY[entity].find((id) => ids.has(id)) ?? null;
}

/** The tooltip and accessible name of a verification: the meaning, never who grants it. `_entity` is kept for callers. */
export function verificationLabel(kind: Verification, _entity: VerificationEntity, t: ComponentsT): string {
  return t(`verification.${kind}`);
}
