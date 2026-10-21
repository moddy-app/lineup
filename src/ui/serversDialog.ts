import {useSearchParams} from 'react-router';

/** `?servers=add` or `?servers=manage` on a dashboard page opens the matching dialog. */
export const SERVERS_PARAM = 'servers';
export type ServersMode = 'add' | 'manage';

export const parseServersMode = (value: string | null): ServersMode | null =>
  value === 'add' || value === 'manage' ? value : null;

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
