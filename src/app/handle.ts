/** What a route can declare in its `handle` (read with useMatches). */
export interface RouteHandle {
  /** A special page (404, errors, sign-in): the shell hides the footer. */
  special?: boolean;
  /**
   * The route needs a session (RequireAuth). While suspended, it shows the
   * suspension screen itself, so the shell does not add its notice on top.
   */
  requiresAuth?: boolean;
}
