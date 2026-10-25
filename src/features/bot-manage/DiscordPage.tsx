import {useState} from 'react';

import {hasCode} from '@/api/client';
import {errorMessage} from '@/api/errors';
import {useRefreshBot} from '@/api/mutations';
import {useRetryAfter} from '@/api/useRetryAfter';
import {useSession} from '@/auth/session';
import {useAuthAction} from '@/auth/useAuthAction';
import {GuildIcon, InlineStats, RelativeTime, RetryButton, StaleNotice} from '@/components';
import {useT} from '@/i18n/useT';
import {SettingsPanel, useSnackbar} from '@/ui';

import {useManagedBot} from './useManagedBot';

/**
 * /bots/:botId/manage/discord : what Lineup reads from Discord (name, avatar,
 * server count, support server) and the refresh, once per minute. Useful after
 * a change in the Developer Portal.
 */
export function Component() {
  const bot = useManagedBot();
  const {t} = useT('botManage');
  const {t: tc} = useT('components');
  const {t: tErrors} = useT('errors');
  const refresh = useRefreshBot();
  const auth = useAuthAction();
  const {canWrite} = useSession();
  const snackbar = useSnackbar();
  const [error, setError] = useState<unknown>(null);
  const wait = useRetryAfter(error);

  const run = async () => {
    setError(null);
    try {
      const profile = await auth.run(() => refresh.mutateAsync(bot.id));
      if (profile) snackbar.show({message: profile.stale ? t('snapshot.staleDone') : t('snapshot.done')});
    } catch (caught) {
      setError(caught);
    }
  };

  const rateLimited = hasCode(error, 'lineup_rate_limited');
  const support = bot.support_guild;
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
        <InlineStats
          items={[{icon: 'dns', value: bot.guild_count, label: tc('bot.servers', {count: bot.guild_count ?? 0})}]}
        />
        {bot.snapshot_at && (
          <RelativeTime
            className="manage-snapshot-date"
            value={bot.snapshot_at}
            format={(relative) => t('snapshot.updated', {relative})}
          />
        )}
      </div>
      {support && (
        <p className="manage-support">
          <GuildIcon id={support.id} iconUrl={support.icon_url} size="small" />
          <span>{tc('bot.supportGuild', {name: support.name ?? support.id})}</span>
        </p>
      )}
      <p className="manage-help">{t('snapshot.rights')}</p>
      {bot.stale && <StaleNotice />}
      {error !== null && !rateLimited && (
        <div className="manage-error" role="alert">
          <p>{errorMessage(error, tErrors, {seconds: wait.seconds})}</p>
          {hasCode(error, 'discord_unavailable') && <RetryButton error={error} onRetry={() => void run()} />}
        </div>
      )}
    </SettingsPanel>
  );
}
