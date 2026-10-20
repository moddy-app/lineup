import type {ApiError} from '@/api/client';
import type {SessionSnapshot} from '@/api/sessionSnapshot';
import type {Me, SanctionInfo} from '@/api/types';

export type SessionStatus = 'loading' | 'anonymous' | 'authenticated' | 'suspended';

export interface DerivedSession {
  status: SessionStatus;
  me?: Me;
  sanction?: SanctionInfo;
  /** Set when the session could not be read (network, 5xx): the person is then treated as signed out. */
  error?: ApiError;
}

/**
 * The session from the state of the `['me']` query.
 *
 *  - A snapshot wins, even with an error next to it (a background refetch that
 *    failed keeps the last known session on screen).
 *  - No snapshot yet and no error: still loading.
 *  - An error with no snapshot (the API is unreachable, or crashed): treated as
 *    anonymous so that public pages work, with the error kept for a message.
 */
export function deriveSession(query: {
  data: SessionSnapshot | undefined;
  error: ApiError | null;
  isPending: boolean;
}): DerivedSession {
  const {data, error, isPending} = query;
  if (data) {
    switch (data.status) {
      case 'authenticated':
        return {status: 'authenticated', me: data.me};
      case 'suspended':
        return {status: 'suspended', sanction: data.sanction};
      case 'anonymous':
        return {status: 'anonymous'};
    }
  }
  if (isPending && !error) return {status: 'loading'};
  return error ? {status: 'anonymous', error} : {status: 'anonymous'};
}
