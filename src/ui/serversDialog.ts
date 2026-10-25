import {useSearchParams} from 'react-router';

/**
 * `?servers=add` or `?servers=manage` (servers), `?servers=add-bot` or
 * `?servers=manage-bots` (bots) on a dashboard page opens the matching dialog.
 */
export const SERVERS_PARAM = 'servers';
export type ServersMode = 'add' | 'manage' | 'add-bot' | 'manage-bots';

const MODES: readonly ServersMode[] = ['add', 'manage', 'add-bot', 'manage-bots'];

export const parseServersMode = (value: string | null): ServersMode | null =>
  MODES.find((mode) => mode === value) ?? null;

/** The servers dialog the address asks for, and how to open, switch or close it (other parameters are kept). */
export function useServersDialog() {
  const [params, setParams] = useSearchParams();
  const mode = parseServersMode(params.get(SERVERS_PARAM));
  const show = (next: ServersMode | null) =>
    setParams(
      (current) => {
        const copy = new URLSearchParams(current);
        if (next) copy.set(SERVERS_PARAM, next);
        else copy.delete(SERVERS_PARAM);
        return copy;
      },
      {replace: true},
    );
  return {mode, show};
}
