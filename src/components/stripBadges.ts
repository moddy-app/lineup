import type {Badge} from '@/api/types';

import {VERIFICATION_BADGE_IDS} from './verification';

/** Whether a badge belongs in the strip: not Discord's, not a verification (the check next to the name shows those). */
export function isStripBadge(badge: Badge): boolean {
  return (
    badge.source !== 'discord' &&
    !badge.id.startsWith('discord_') &&
    !(VERIFICATION_BADGE_IDS as readonly string[]).includes(badge.id)
  );
}
