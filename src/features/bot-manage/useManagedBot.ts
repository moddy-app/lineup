import {useOutletContext} from 'react-router';

import type {BotProfile} from '@/api/types';

/** The bot of the management layout (`BotManageLayout` reads it once and passes it down). */
export function useManagedBot(): BotProfile {
  return useOutletContext<BotProfile>();
}
