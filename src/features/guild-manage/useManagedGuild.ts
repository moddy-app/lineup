import {useOutletContext} from 'react-router';

import type {GuildProfile} from '@/api/types';

/** The server of the management layout (`GuildManageLayout` reads it once and passes it down). */
export function useManagedGuild(): GuildProfile {
  return useOutletContext<GuildProfile>();
}
