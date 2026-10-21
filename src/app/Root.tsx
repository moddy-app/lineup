import {SessionProvider} from '@/auth/session';

import {AppShell} from './AppShell';

/** The session lives inside the router (signing out navigates), around the whole shell. */
export function Root() {
  return (
    <SessionProvider>
      <AppShell />
    </SessionProvider>
  );
}
