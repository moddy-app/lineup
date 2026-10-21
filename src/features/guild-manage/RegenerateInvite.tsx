import {useState} from 'react';

import {hasCode} from '@/api/client';
import {errorMessage} from '@/api/errors';
import {useUpdateGuild} from '@/api/mutations';
import type {GuildProfile} from '@/api/types';
import {useRetryAfter} from '@/api/useRetryAfter';
import {useSession} from '@/auth/session';
import {useAuthAction} from '@/auth/useAuthAction';
import {RetryButton} from '@/components';
import {useT} from '@/i18n/useT';
import {useSnackbar} from '@/ui';

/**
 * Moddy is on the server: it can create the permanent invitation itself
 * (`PUT` with `invite: null`). The cache is updated from the response, so the
 * new code shows in the page. The manual field stays available.
 */
export function RegenerateInvite({guild}: {guild: GuildProfile}) {
  const {t} = useT('guildManage');
  const {t: tErrors} = useT('errors');
  const update = useUpdateGuild();
  const auth = useAuthAction();
  const {canWrite} = useSession();
  const snackbar = useSnackbar();
  const [error, setError] = useState<unknown>(null);
  const wait = useRetryAfter(error);

  const run = async () => {
    setError(null);
    try {
      const profile = await auth.run(() => update.mutateAsync({guildId: guild.id, body: {invite: null}}));
      if (profile) snackbar.show({message: t('invite.regenerated')});
    } catch (caught) {
      setError(caught);
    }
  };

  const rateLimited = hasCode(error, 'lineup_rate_limited');
  const counting = wait.active && (rateLimited || hasCode(error, 'discord_unavailable'));
  return (
    <div className="manage-regenerate">
      <md-outlined-button disabled={update.isPending || counting || !canWrite} onclick={() => void run()}>
        <md-icon slot="icon" className="filled" aria-hidden="true">
          autorenew
        </md-icon>
        {counting
          ? t('invite.waitIn', {seconds: wait.seconds})
          : update.isPending
            ? t('invite.regenerating')
            : t('invite.regenerate')}
      </md-outlined-button>
      <p className="manage-help">{t('invite.regenerateHelp')}</p>
      {error !== null && !rateLimited && (
        <div className="manage-error" role="alert">
          <p>{errorMessage(error, tErrors, {context: 'manage', seconds: wait.seconds})}</p>
          {hasCode(error, 'invite_required') && <p>{t('invite.manualFallback')}</p>}
          {hasCode(error, 'discord_unavailable') && <RetryButton error={error} onRetry={() => void run()} />}
        </div>
      )}
    </div>
  );
}
