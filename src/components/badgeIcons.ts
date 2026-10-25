/** The Material Symbol of each badge (LINEUP.md §10 and the Discord flags of the catalog). */

export const FALLBACK_BADGE_ICON = 'workspace_premium';

const BADGE_ICONS: Readonly<Record<string, string>> = {
  discord_verified: 'verified',
  discord_partner: 'handshake',
  moddy_installed: 'smart_toy',
  moddy_premium: 'crown',
  nsfw: 'explicit',
  moddy_staff: 'construction',
  lineup_verified: 'verified',
  moddy_partner: 'handshake',
  moddy_server: 'verified',
  discord_staff: 'badge',
  discord_partnered_server_owner: 'diversity_3',
  discord_hypesquad_events: 'celebration',
  discord_bug_hunter_level_1: 'bug_report',
  discord_bug_hunter_level_2: 'bug_report',
  discord_hypesquad_house_bravery: 'local_fire_department',
  discord_hypesquad_house_brilliance: 'lightbulb',
  discord_hypesquad_house_balance: 'balance',
  discord_early_supporter: 'favorite',
  discord_verified_bot: 'smart_toy',
  discord_verified_app: 'verified',
  discord_early_verified_bot_developer: 'code',
  discord_certified_moderator: 'gavel',
  discord_active_developer: 'code',
};

/** The icon of a badge id; a badge the site does not know yet gets a generic one. */
export function badgeIcon(id: string): string {
  return BADGE_ICONS[id] ?? FALLBACK_BADGE_ICON;
}

export function hasBadgeIcon(id: string): boolean {
  return id in BADGE_ICONS;
}
