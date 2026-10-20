import {Outlet} from 'react-router';

import {useSession} from '@/auth/session';
import {PageLoading} from '@/ui';

import {Component as NotFound} from './NotFoundPage';
import {SessionError} from './SessionError';
import {SignInPrompt, type AuthPurpose} from './SignInPrompt';
import {SuspendedScreen} from './SuspendedScreen';

/**
 * A route wrapper for the pages that need a session (the person's own pages,
 * the editor, the claim and management of a server, the staff console):
 *
 *   loading        the page loader
 *   anonymous      the sign-in prompt, or SessionError if the API is unreachable
 *   suspended      the SuspendedScreen
 *   authenticated  the page; `staff` also needs `is_staff`, and the 404 is shown
 *                  otherwise, so the console is not revealed
 *
 * Used as a pathless layout route in routes.tsx.
 */
export function RequireAuth({purpose, staff}: {purpose: AuthPurpose; staff?: boolean}) {
  const session = useSession();

  switch (session.status) {
    case 'loading':
      return <PageLoading />;
    case 'suspended':
      return <SuspendedScreen />;
    case 'anonymous':
      return session.error ? <SessionError /> : <SignInPrompt purpose={purpose} />;
    case 'authenticated':
      return staff && !session.me?.user.is_staff ? <NotFound /> : <Outlet />;
  }
}
