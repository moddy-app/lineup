import {type ReactNode, useState} from 'react';

import {hasCode} from '@/api/client';
import {errorMessage} from '@/api/errors';
import {useUpdateGuild} from '@/api/mutations';
import type {GuildProfile} from '@/api/types';
import {useRetryAfter} from '@/api/useRetryAfter';
import {useSession} from '@/auth/session';
import {useAuthAction} from '@/auth/useAuthAction';
import {useT} from '@/i18n/useT';
import {useSnackbar} from '@/ui';

/**
 * Moddy is on the server: it can create the permanent invitation itself
 * (`PUT` with `invite: null`). The cache is updated from the response, so the
 * new code shows in the page. `children` sit next to the button (the link to
 * paste an invitation); `onManual` is called when the API asks for one
 * (`invite_required`), so the page opens the field. An error is one line under the button.
 */
export function RegenerateInvite({
  guild,
  onManual,
  children,
}: {
  guild: GuildProfile;
  onManual?: () => void;
  children?: ReactNode;
}) {
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
      if (hasCode(caught, 'invite_required')) onManual?.();
    }
  };

  const rateLimited = hasCode(error, 'lineup_rate_limited');
  const counting = wait.active && (rateLimited || hasCode(error, 'discord_unavailable'));
  return (
    <div className="invite-actions">
      <div className="invite-buttons">
        <md-outlined-button
          type="button"
          disabled={update.isPending || counting || !canWrite}
          onclick={() => void run()}
        >
          {counting
            ? t('invite.waitIn', {seconds: wait.seconds})
            : update.isPending
              ? t('invite.regenerating')
              : t('invite.regenerate')}
        </md-outlined-button>
        {children}
      </div>
      {error !== null && !rateLimited && (
        <p className="manage-field-error" role="alert">
          {errorMessage(error, tErrors, {context: 'manage', seconds: wait.seconds})}
        </p>
      )}
    </div>
  );
}
