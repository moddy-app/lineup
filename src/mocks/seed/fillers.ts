/**
 * Filler for the directory: banned servers (global sanction) that sit in the
 * middle of the newest claims. They are removed AFTER the directory page is
 * read, so one whole page comes back empty and still carries a cursor
 * (LINEUP.md §0, §6.2). Their names are what a spam server would pick.
 */

import type {DiscordGuild, GuildProfileRow} from '../model';
import {iso, MINUTE, snowflake} from '../time';

const NAMES = ['Bonus Crypto Club', 'Gain Rapide', 'Staff Cash Academy', 'Invest Together', 'Revenus Passifs FR', 'Signaux Pro'];

export function seedFillerGuilds(count: number, newest: number, claimedBy: string): {
  guilds: DiscordGuild[];
  profiles: GuildProfileRow[];
} {
  const guilds: DiscordGuild[] = [];
  const profiles: GuildProfileRow[] = [];
  for (let index = 0; index < count; index += 1) {
    const id = snowflake(Date.UTC(2025, 5, 1 + (index % 20), 10, index), 300 + index);
    const claimed = iso(newest - index * MINUTE);
    guilds.push({
      id,
      name: `${NAMES[index % NAMES.length]} #${index + 1}`,
      icon_url: null,
      banner_url: null,
      splash_url: null,
      description: null,
      features: [],
      nsfw_level: 0,
      premium_subscription_count: 0,
      premium_tier: 0,
      vanity_url_code: null,
      member_count: 100 + index,
      presence_count: 10,
      verification_level: 0,
      has_moddy: false,
      premium_effective: false,
      owner_id: claimedBy,
      sanction: {level: 'ban', subject_type: 'guild', references: [`F${String(index).padStart(5, '0')}`], expires_at: null},
    });
    profiles.push({
      guild_id: id,
      invite_code: `spam-${index + 1}`,
      description: null,
      links: [],
      theme: 'other',
      tags: [],
      languages: ['fr'],
      snapshot_at: claimed,
      has_moddy: false,
      claimed_by: claimedBy,
      listed: true,
      invite_invalid: false,
      refresh_blocked: false,
      created_at: claimed,
      updated_at: claimed,
    });
  }
  return {guilds, profiles};
}
