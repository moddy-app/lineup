import type {Badge} from '@/api/types';

/**
 * Whether a badge belongs in the strip: not Discord's (source or `discord_*`
 * id). The verification badges are in: the check next to the name shows them
 * too, the strip lists them like the others.
 */
export function isStripBadge(badge: Badge): boolean {
  return badge.source !== 'discord' && !badge.id.startsWith('discord_');
}
