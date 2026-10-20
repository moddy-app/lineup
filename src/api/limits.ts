/**
 * The limits of LINEUP.md §4 ("Autres limites") that the catalog does NOT
 * carry. Those the catalog does carry (`limits`: title, description, positions,
 * tags, links, quotas…) are read from it, never copied here. These are fixed
 * by the API's validation; forms use them for counters and `maxlength`.
 */

export const FIELD_LIMITS = {
  link: {labelMax: 40, urlMax: 500},
  guild: {descriptionMax: 2000, inviteMin: 2, inviteMax: 200},
  profile: {headlineMax: 120, bioMax: 2000},
  experience: {nameMin: 1, nameMax: 100, descriptionMax: 1000, positionOtherMin: 1, positionOtherMax: 40, noteMax: 500},
  report: {detailsMax: 1000},
  staff: {noteMax: 500, reasonMin: 1, reasonMax: 500, badgeNoteMax: 200},
  timezoneMax: 64,
  commitment: {hoursMin: 1, hoursMax: 168, openingsMin: 1, openingsMax: 50},
  /** Query parameters. */
  query: {qMax: 100, themeMax: 30, feedPositionsMax: 10},
  /** Page sizes: default and maximum, per list. */
  page: {
    feed: {default: 20, max: 50},
    guilds: {default: 24, max: 50},
    myPosts: {default: 20, max: 50},
    staff: {default: 50, max: 100},
    staffBadges: {default: 100, max: 200},
  },
} as const;
