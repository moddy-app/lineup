import {SnapshotCard} from './SnapshotCard';
import {useManagedGuild} from './useManagedGuild';

/** /guilds/:guildId/manage/discord : the Discord snapshot and the refresh. */
export function Component() {
  return <SnapshotCard guild={useManagedGuild()} />;
}
