/** What a route can declare in its `handle` (read with useMatches). */
export interface RouteHandle {
  /** A special page (404, errors, sign-in): the shell hides the footer. */
  special?: boolean;
}
