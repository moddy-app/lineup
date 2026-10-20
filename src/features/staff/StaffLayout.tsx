import {Outlet} from 'react-router';

/**
 * Layout of the staff console (/staff/*). Phase 5 puts the section tabs and the
 * staff-only guard here; the sections render in the Outlet.
 */
export function Component() {
  return <Outlet />;
}
