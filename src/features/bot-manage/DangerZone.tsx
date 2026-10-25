import {useState} from 'react';
import {useNavigate} from 'react-router';

import {hasCode, isApiError} from '@/api/client';
import {errorMessage} from '@/api/errors';
import {useDeleteBot} from '@/api/mutations';
import type {BotProfile} from '@/api/types';
import {paths} from '@/app/paths';
import {useSession} from '@/auth/session';
import {useAuthAction} from '@/auth/useAuthAction';
import {RetryButton} from '@/components';
import {SanctionNotice} from '@/components/SanctionNotice';
import {useT} from '@/i18n/useT';
import {ConfirmDialog, SettingsPanel, useSnackbar} from '@/ui';

/** Deleting the bot's profile, behind a confirmation that says its posts will be closed. */
export function DangerZone({bot}: {bot: BotProfile}) {
  const {t} = useT('botManage');
  const {t: tErrors} = useT('errors');
  const remove = useDeleteBot();
  const auth = useAuthAction();
  const {canWrite} = useSession();
  const navigate = useNavigate();
  const snackbar = useSnackbar();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const name = bot.name ?? t('unknownName');

  const confirm = async () => {
    setError(null);
    try {
      const done = await auth.run(async () => {
        await remove.mutateAsync(bot.id);
        return true;
      });
      if (!done) return;
      setOpen(false);
      snackbar.show({message: t('danger.done', {name})});
      void navigate(paths.myBots());
    } catch (caught) {
      setError(caught);
    }
  };

  return (
    <>
      <SettingsPanel
        className="manage-panel manage-danger"
        title={t('danger.title')}
        description={t('danger.body')}
        actions={
          <md-outlined-button
            className="manage-danger-button"
            disabled={!canWrite}
            onclick={() => {
              setError(null);
              setOpen(true);
            }}
          >
            <md-icon slot="icon" className="filled" aria-hidden="true">
              delete
            </md-icon>
            {t('danger.action')}
          </md-outlined-button>
        }
      />
      <ConfirmDialog
        open={open}
        destructive
        busy={remove.isPending}
        title={t('danger.confirmTitle', {name})}
        confirmLabel={t('danger.confirm')}
        onCancel={() => setOpen(false)}
        onConfirm={() => void confirm()}
        body={
          <div className="manage-confirm">
            <p>{t('danger.confirmBody')}</p>
            <ul>
              <li>{t('danger.effectPosts')}</li>
              <li>{t('danger.effectHidden')}</li>
              <li>{t('danger.effectReclaim')}</li>
            </ul>
            {error !== null &&
              (hasCode(error, 'guild_suspended') && isApiError(error) ? (
                <SanctionNotice error={error} />
              ) : (
                <div className="manage-error" role="alert">
                  <p>{errorMessage(error, tErrors)}</p>
                  {hasCode(error, 'discord_unavailable') && (
                    <RetryButton error={error} onRetry={() => void confirm()} busy={remove.isPending} />
                  )}
                </div>
              ))}
          </div>
        }
      />
    </>
  );
}
