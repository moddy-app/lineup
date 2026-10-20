/**
 * Stable ids for the seed. Snowflakes carry their creation date (`created_at`
 * of an account or a server is read back from them), so each is built from a
 * date; the same date always gives the same id. UUIDs are fixed and readable
 * so the report can name a URL (`/posts/…`).
 */

import {snowflake} from '../time';

const at = (y: number, m: number, d: number, seq: number, hh = 12, mm = 0) =>
  snowflake(Date.UTC(y, m - 1, d, hh, mm, 7), seq);

/** People (the id is the Discord account's creation date). */
export const U = {
  camille: at(2019, 3, 12, 101, 9, 41),
  noe: at(2018, 7, 2, 102, 18, 4),
  dylan: at(2020, 1, 25, 103),
  ines: at(2024, 9, 4, 104, 16, 22),
  alex: at(2018, 5, 2, 105, 10, 11),
  sam: at(2019, 11, 17, 106),
  leo: at(2020, 6, 8, 107),
  lucie: at(2021, 2, 9, 108),
  theo: at(2022, 4, 30, 109),
  amira: at(2018, 12, 5, 110),
  jonas: at(2019, 8, 23, 111),
  marta: at(2021, 10, 14, 112),
  hugo: at(2020, 9, 3, 113),
  emma: at(2019, 5, 21, 114),
  karim: at(2018, 9, 12, 115),
  recrut: at(2025, 8, 1, 116),
} as const;

/** Servers (the id is the server's creation date). */
export const G = {
  cubelands: at(2021, 2, 14, 201, 9, 12),
  moddy: at(2023, 11, 20, 202),
  atelier: at(2022, 6, 3, 203),
  pixel: at(2020, 11, 8, 204),
  anime: at(2019, 8, 21, 205),
  velvet: at(2021, 9, 30, 206),
  nox: at(2020, 3, 17, 207),
  hyrule: at(2022, 1, 19, 208),
  trade: at(2025, 7, 11, 209),
  lumen: at(2023, 3, 6, 210),
  devcorner: at(2021, 7, 27, 211),
  arena: at(2021, 5, 5, 212),
  // Not claimed on Lineup (no profile).
  cafe: at(2023, 8, 15, 221),
  studio: at(2024, 2, 2, 222),
  corbeau: at(2022, 10, 10, 223),
  lumiere: at(2022, 12, 1, 224),
  chroniqueurs: at(2024, 10, 18, 225),
} as const;

const uuid = (kind: string, n: number) => `${kind}0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/** Posts: `a…`, experiences: `e…`, reports: `c…` (readable prefixes). */
export const postId = (n: number) => uuid('a', n);
export const experienceId = (n: number) => uuid('e', n);
export const reportId = (n: number) => uuid('c', n);
export const fillerPostId = (n: number) => uuid('b', n);
