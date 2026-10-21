/**
 * The browser actions that leave the app, behind one object so that tests can
 * watch them (jsdom cannot navigate).
 */
export const browser = {
  /** A full navigation: another site, or the API's sign-in. */
  navigate(url: string): void {
    window.location.assign(url);
  },
};
