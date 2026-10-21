import {useState} from 'react';

import {hasCode} from '@/api/client';
import {errorMessage} from '@/api/errors';
import {useRefreshGuild} from '@/api/mutations';
import type {GuildProfile} from '@/api/types';
import {useRetryAfter} from '@/api/useRetryAfter';
import {useSession} from '@/auth/session';
import {useAuthAction} from '@/auth/useAuthAction';
import {InlineStats, RelativeTime, RetryButton, StaleNotice} from '@/components';
import {useT} from '@/i18n/useT';
import {SettingsPanel, useSnackbar} from '@/ui';

/** The Discord snapshot of the server and the button that reads it again (one per minute). */
export function SnapshotCard({guild}: {guild: GuildProfile}) {
  const {t} = useT('guildManage');
  const {t: tErrors} = useT('errors');
  const refresh = useRefreshGuild();
  const auth = useAuthAction();
  const {canWrite} = useSession();
  const snackbar = useSnackbar();
  const [error, setError] = useState<unknown>(null);
  const wait = useRetryAfter(error);

  const run = async () => {
    setError(null);
    try {
      const profile = await auth.run(() => refresh.mutateAsync(guild.id));
      if (profile) snackbar.show({message: profile.stale ? t('snapshot.staleDone') : t('snapshot.done')});
    } catch (caught) {
      setError(caught);
    }
  };

  const rateLimited = hasCode(error, 'lineup_rate_limited');
  return (
    <SettingsPanel
      className="manage-panel"
      title={t('snapshot.title')}
      description={t('snapshot.body')}
      actions={
        <md-outlined-button disabled={refresh.isPending || wait.active || !canWrite} onclick={() => void run()}>
          <md-icon slot="icon" className="filled" aria-hidden="true">
            sync
          </md-icon>
          {wait.active && rateLimited
            ? t('snapshot.waitIn', {seconds: wait.seconds})
            : refresh.isPending
              ? t('snapshot.refreshing')
              : t('snapshot.refresh')}
        </md-outlined-button>
      }
    >
      <div className="manage-snapshot">
        <InlineStats items={[{icon: 'group', value: guild.member_count, label: t('snapshot.members')}]} />
        {guild.snapshot_at && (
          <RelativeTime
            className="manage-snapshot-date"
            value={guild.snapshot_at}
            format={(relative) => t('snapshot.updated', {relative})}
          />
        )}
      </div>
      {guild.stale && <StaleNotice />}
      {error !== null && !rateLimited && (
        <div className="manage-error" role="alert">
          <p>{errorMessage(error, tErrors, {context: 'manage', seconds: wait.seconds})}</p>
          {hasCode(error, 'discord_unavailable') && <RetryButton error={error} onRetry={() => void run()} />}
        </div>
      )}
    </SettingsPanel>
  );
}
