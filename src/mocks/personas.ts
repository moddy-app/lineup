/**
 * Who is signed in, in the mock. The persona lives in localStorage
 * (`lineup-mock-persona`) and stands for the session cookie.
 */

import {getString, setString} from '@/lib/storage';

import type {Session} from './server/dispatch';
import {U} from './seed/ids';

export type PersonaId = 'anonymous' | 'member' | 'dashboard' | 'staff' | 'suspended' | 'newcomer';

export interface Persona {
  id: PersonaId;
  label: string;
  /** What it lets you test. */
  description: string;
  session: Session | null;
}

export const PERSONAS: Persona[] = [
  {
    id: 'anonymous',
    label: 'Anonymous',
    description: 'Not signed in: public pages, 401 on everything else.',
    session: null,
  },
  {
    id: 'member',
    label: 'Member (Camille)',
    description:
      'Normal account with Lineup scopes. Manages Atelier du Phénix (Moddy, at its quota of 5 posts) and Pixel Forge (no Moddy), Café des Mods (Moddy) and Studio Nocturne (no Moddy) to claim, a suspended server, and Guilde du Corbeau after refreshing the list. Posts and experiences in every status.',
    session: {userId: U.camille, hasLineupScopes: true},
  },
  {
    id: 'dashboard',
    label: 'Dashboard session (Camille)',
    description:
      'Same person, but the session comes from the dashboard: automatic verification answers 403 lineup_reauth_required.',
    session: {userId: U.camille, hasLineupScopes: false},
  },
  {
    id: 'staff',
    label: 'Staff (Noé)',
    description: 'Moddy staff: staff console, edits everything, sees unlisted and suspended content.',
    session: {userId: U.noe, hasLineupScopes: true},
  },
  {
    id: 'suspended',
    label: 'Suspended (Dylan)',
    description: 'Globally banned: every session route answers 403 user_suspended; public reads still work.',
    session: {userId: U.dylan, hasLineupScopes: true},
  },
  {
    id: 'newcomer',
    label: 'Newcomer (Inès)',
    description: 'Signed in with nothing on Lineup: no profile, no experience, no post. Manages one unclaimed server.',
    session: {userId: U.ines, hasLineupScopes: true},
  },
];

const KEY = 'lineup-mock-persona';

export function getPersonaId(): PersonaId {
  const stored = getString(KEY);
  return PERSONAS.some((persona) => persona.id === stored) ? (stored as PersonaId) : 'anonymous';
}

const listeners = new Set<() => void>();

export function setPersonaId(id: PersonaId): void {
  setString(KEY, id);
  for (const listener of listeners) listener();
}

/** For `useSyncExternalStore`: the dev panel shows who is signed in, also after a sign-out from the app. */
export function subscribePersona(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function currentSession(): Session | null {
  const id = getPersonaId();
  return PERSONAS.find((persona) => persona.id === id)?.session ?? null;
}
