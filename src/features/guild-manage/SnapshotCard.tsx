import {useState} from 'react';

import {hasCode} from '@/api/client';
import {errorMessage} from '@/api/errors';
import {useRefreshGuild} from '@/api/mutations';
import type {GuildProfile} from '@/api/types';
import {useRetryAfter} from '@/api/useRetryAfter';
import {useAuthAction} from '@/auth/useAuthAction';
import {useSession} from '@/auth/session';
import {RetryButton, StaleNotice} from '@/components';
import {useT} from '@/i18n/useT';
import {Pill, Section, Stat, useSnackbar} from '@/ui';

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
    <Section title={t('snapshot.title')}>
      <p>{t('snapshot.body')}</p>
      <div className="manage-stats">
        {guild.member_count !== null && <Stat value={guild.member_count} label={t('snapshot.members')} />}
        {guild.presence_count !== null && <Stat value={guild.presence_count} label={t('snapshot.online')} />}
      </div>
      <p className="manage-invite">
        <span>{t('snapshot.invite')}</span>
        {guild.invite ? (
          <>
            <Pill>{guild.invite.code}</Pill>
            <span>{guild.invite.valid ? t('snapshot.inviteValid') : t('snapshot.inviteLost')}</span>
          </>
        ) : (
          <span>{t('snapshot.noInvite')}</span>
        )}
      </p>
      {guild.stale && <StaleNotice />}
      {error !== null && !rateLimited && (
        <div className="manage-error" role="alert">
          <p>{errorMessage(error, tErrors, {context: 'manage', seconds: wait.seconds})}</p>
          {hasCode(error, 'discord_unavailable') && <RetryButton error={error} onRetry={() => void run()} />}
        </div>
      )}
      <div className="card-actions">
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
      </div>
    </Section>
  );
}
