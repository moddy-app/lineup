/**
 * The seed: a believable community, built relative to `now` so "published
 * two days ago" stays true whenever the mock starts. See ./README in the
 * report for the notable cases; the ids are in ./ids.ts.
 */

import {newRuntime, type Db} from '../env';
import {compareKeyed} from '../logic/cursor';
import {isLive, isNsfwGuild, isNsfwPost} from '../logic/visibility';
import {DAY, HOUR, iso} from '../time';
import {seedExperiences} from './experiences';
import {seedFillerGuilds} from './fillers';
import {seedDiscordGuilds, seedGuildProfiles, seedInvites, seedMembers} from './guilds';
import {G, U} from './ids';
import {seedBadgeGrants, seedReports} from './moderation';
import {seedFillerPosts, seedPosts} from './posts';
import {seedUsers} from './users';

/** Bump when the seed's shape changes: a stored database of another version is thrown away. */
export const DB_VERSION = 1;

const FEED_PAGE = 20;
const DIRECTORY_PAGE = 24;

const byKey = <T>(items: T[], key: (item: T) => {at: string; id: string}) =>
  [...items].sort((a, b) => compareKeyed(true)(key(a), key(b)));

export function createSeedDb(now: Date = new Date()): Db {
  const db: Db = {
    version: DB_VERSION,
    users: seedUsers(now),
    guilds: Object.fromEntries(seedDiscordGuilds().map((guild) => [guild.id, guild])),
    profiles: Object.fromEntries(seedGuildProfiles(now).map((profile) => [profile.guild_id, profile])),
    members: seedMembers(),
    invites: Object.fromEntries(seedInvites(now).map((invite) => [invite.code.toLowerCase(), invite])),
    posts: Object.fromEntries(seedPosts(now).map((post) => [post.id, post])),
    experiences: Object.fromEntries(seedExperiences(now).map((row) => [row.id, row])),
    reports: Object.fromEntries(seedReports(now).map((report) => [report.id, report])),
    badges: seedBadgeGrants(now),
    // Camille's server list was cached before she gained rights on Guilde du Corbeau: it does not contain it, and
    // stays that way (pinned) until she presses "I changed my rights" (`refresh-guilds`) — §13 claim flow.
    guildListCache: {
      [U.camille]: {
        fetched_at: iso(now.getTime() - HOUR),
        pinned: true,
        guilds: [
          {id: G.atelier, owner: true, permissions: ['ADMINISTRATOR']},
          {id: G.pixel, owner: false, permissions: ['ADMINISTRATOR']},
          {id: G.cafe, owner: true, permissions: ['ADMINISTRATOR']},
          {id: G.studio, owner: false, permissions: ['MANAGE_GUILD', 'MANAGE_MESSAGES']},
          {id: G.cubelands, owner: false, permissions: ['MANAGE_MESSAGES', 'MODERATE_MEMBERS']},
          {id: G.anime, owner: false, permissions: []},
        ],
      },
    },
    rt: newRuntime(),
  };
  addFillers(db, now);
  return db;
}

/**
 * Banned accounts' and servers' rows that make a page of the feed and a page
 * of the directory come back EMPTY with a non-null cursor. They are placed
 * after the first few real rows so that, at the default page sizes (20 and
 * 24), page 1 is short, page 2 is empty and page 3 has the rest.
 */
function addFillers(db: Db, now: Date): void {
  const env = {db, now, discordDown: false, verifyOutcome: 'auto' as const};

  // --- the feed ------------------------------------------------------------------------------------------------
  const feedRows = byKey(
    Object.values(db.posts)
      .filter((post) => isLive(post, now))
      .filter((post) => post.kind === 'user' || db.profiles[post.guild_id ?? '']?.listed === true)
      .filter((post) => !isNsfwPost(env, post)),
    (post) => ({at: post.published_at ?? post.created_at, id: post.id}),
  );
  const publishedAt = (post: (typeof feedRows)[number]) => Date.parse(post.published_at ?? post.created_at);
  // The first strict drop in time after a dozen real rows: the fillers fit exactly in that gap.
  let split = 12;
  while (split < feedRows.length && publishedAt(feedRows[split - 1]!) === publishedAt(feedRows[split]!)) split += 1;
  const cut = feedRows[split - 1];
  const next = feedRows[split];
  if (cut && next) {
    const newest = publishedAt(cut);
    const count = 2 * FEED_PAGE - split;
    const step = Math.max(1, Math.min(60_000, Math.floor((newest - publishedAt(next)) / (count + 2))));
    for (const post of seedFillerPosts(count, newest - step, step)) db.posts[post.id] = post;
  }

  // --- the directory -------------------------------------------------------------------------------------------
  const DIRECTORY_REAL_FIRST = 4;
  const directoryRows = byKey(
    Object.values(db.profiles).filter(
      (profile) => profile.listed && !isNsfwGuild(env, profile.guild_id) && !db.guilds[profile.guild_id]?.sanction,
    ),
    (profile) => ({at: profile.created_at, id: profile.guild_id}),
  );
  const first = directoryRows[DIRECTORY_REAL_FIRST - 1];
  const second = directoryRows[DIRECTORY_REAL_FIRST];
  if (first && second) {
    // The whole cluster, Trade Hub included, is `DIRECTORY_PAGE - FIRST + DIRECTORY_PAGE` rows.
    const cluster = DIRECTORY_PAGE - DIRECTORY_REAL_FIRST + DIRECTORY_PAGE;
    const newest = Date.parse(first.created_at) - 5 * DAY;
    const trade = db.profiles[G.trade];
    if (trade) trade.created_at = iso(newest);
    const {guilds, profiles} = seedFillerGuilds(cluster - 1, newest - 10 * 60_000, U.recrut);
    for (const guild of guilds) db.guilds[guild.id] = guild;
    for (const profile of profiles) db.profiles[profile.guild_id] = profile;
  }
}
