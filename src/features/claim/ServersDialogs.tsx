import {useState} from 'react';

import {type ServersMode} from '@/ui';

import {AddServerDialog} from './AddServerDialog';
import {ManageServersDialog} from './ManageServersDialog';

/**
 * The two server dialogs of the dashboard, driven by `?servers=` (see
 * `useServersDialog`). Both stay mounted once the first one is asked for so the
 * closing animation plays; each starts afresh (state, draft) at every opening.
 */
export default function ServersDialogs({
  mode,
  show,
}: {
  mode: ServersMode | null;
  show: (mode: ServersMode | null) => void;
}) {
  const [previous, setPrevious] = useState(mode);
  const [run, setRun] = useState(0);
  if (mode !== previous) {
    setPrevious(mode);
    if (mode !== null) setRun(run + 1);
  }
  return (
    <>
      <AddServerDialog key={`add${run}`} open={mode === 'add'} onClose={() => show(null)} />
      <ManageServersDialog
        key={`manage${run}`}
        open={mode === 'manage'}
        onClose={() => show(null)}
        onAdd={() => show('add')}
      />
    </>
  );
}
