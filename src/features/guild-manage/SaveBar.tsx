import {hasCode, isApiError} from '@/api/client';
import {errorMessage} from '@/api/errors';
import {RetryButton} from '@/components';
import {useSession} from '@/auth/session';
import {useT} from '@/i18n/useT';
import {Icon} from '@/ui';

import {SanctionNotice} from '../guilds/SanctionNotice';

export interface SaveBarProps {
  dirty: boolean;
  error: unknown;
  validation: boolean;
  unmapped: string[];
  /** An `invite_*` error: shown on the field, not here. */
  inviteCode: boolean;
  pending: boolean;
  onReset: () => void;
  onRetry: () => void;
}

/** The sticky bar of a management form: shown while there are changes or an error. Cancel (outlined), Save (filled). */
export function SaveBar({dirty, error, validation, unmapped, inviteCode, pending, onReset, onRetry}: SaveBarProps) {
  const {t} = useT('guildManage');
  const {t: tErrors} = useT('errors');
  const {canWrite} = useSession();
  if (!dirty && error === null) return null;
  return (
    <div className="manage-savebar">
      {error !== null &&
        (hasCode(error, 'guild_suspended') && isApiError(error) ? (
          <SanctionNotice error={error} />
        ) : inviteCode ? null : (
          <div className="manage-error" role="alert">
            <p>
              <Icon name="error" filled />
              <span>{validation ? t('errors.fixFields') : errorMessage(error, tErrors, {context: 'manage'})}</span>
            </p>
            {unmapped.map((message) => (
              <p key={message}>{message}</p>
            ))}
            {hasCode(error, 'discord_unavailable') && <RetryButton error={error} onRetry={onRetry} busy={pending} />}
          </div>
        ))}
      <div className="manage-savebar-row">
        <span className="manage-dirty">{dirty ? t('bar.unsaved') : ''}</span>
        <div className="manage-savebar-actions">
          <md-outlined-button type="button" disabled={!dirty || pending} onclick={onReset}>
            {t('bar.reset')}
          </md-outlined-button>
          <md-filled-button type="submit" disabled={!dirty || pending || !canWrite}>
            {pending ? t('bar.saving') : t('bar.save')}
          </md-filled-button>
        </div>
      </div>
    </div>
  );
}
