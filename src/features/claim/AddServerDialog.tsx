import {useEffect, useState} from 'react';
import {useNavigate} from 'react-router';

import {hasCode, isApiError} from '@/api/client';
import {errorMessage, fieldErrors} from '@/api/errors';
import {FIELD_LIMITS} from '@/api/limits';
import {useClaimGuild, useRefreshMyGuilds} from '@/api/mutations';
import {useMyGuilds} from '@/api/queries';
import type {ClaimGuildBody, RefreshGuildsResponse} from '@/api/types';
import {useRetryAfter} from '@/api/useRetryAfter';
import {paths} from '@/app/paths';
import {registerBeforeLogin} from '@/auth/beforeLogin';
import {useReauthenticate} from '@/auth/reauth';
import {useSession} from '@/auth/session';
import {useAuthAction} from '@/auth/useAuthAction';
import {EmptyState, ErrorState, GuildIcon, InviteHelp, RetryButton, StaleNotice} from '@/components';
import {SanctionNotice} from '@/components/SanctionNotice';
import {useT} from '@/i18n/useT';
import {getItem, removeItem, setItem} from '@/lib/storage';
import {CardActions, Dialog, Icon, LinkButton, Spinner, TextField, useSnackbar} from '@/ui';

import {CLAIM_DRAFT_KEY, type ClaimDraft, parseClaimDraft} from './claimDraft';
import './claim.css';

/** md-dialog focuses the element marked `autofocus` (not the first button of the content). */
const AUTOFOCUS: object = {autofocus: true};

/** These land on the invitation field itself. */
const INVITE_CODES = [
  'invite_invalid',
  'invite_not_found',
  'invite_expiring',
  'invite_guild_mismatch',
  'invite_required',
];

/** Where the dialog is: the list, or the claim of one server (`guildId`) or of any server by invitation (null). */
type Step = {guildId: string | null} | null;

/**
 * "Add a server", in two steps inside one dialog: the servers you manage that
 * are not on Lineup yet, then the claim of the chosen one. Moddy on the server
 * (`has_moddy`): `guild_id` alone, the API creates the permanent invitation, so
 * there is no field. Without Moddy (or when the API answers `invite_required`): an
 * invitation that never expires. Mounted afresh at each opening.
 */
export function AddServerDialog({open, onClose}: {open: boolean; onClose: () => void}) {
  const {t} = useT('claim');
  const {t: tErrors} = useT('errors');
  const navigate = useNavigate();
  const snackbar = useSnackbar();
  const auth = useAuthAction();
  const reauth = useReauthenticate();
  const {canWrite} = useSession();
  const guilds = useMyGuilds();
  const refreshList = useRefreshMyGuilds();
  const claim = useClaimGuild();

  // Signing in leaves the page: the dialog comes back at the same step, with what was typed.
  const [draft] = useState(() => parseClaimDraft(getItem<unknown>(CLAIM_DRAFT_KEY, null, 'session')));
  useEffect(() => removeItem(CLAIM_DRAFT_KEY, 'session'), []);
  const [step, setStep] = useState<Step>(draft ? {guildId: draft.guildId} : null);
  const [invite, setInvite] = useState(draft?.invite ?? '');
  const [error, setError] = useState<unknown>(null);
  // Moddy left the server since the list was read: the API asked for an invitation after all.
  const [needsInvite, setNeedsInvite] = useState(false);
  const [refreshError, setRefreshError] = useState<unknown>(null);
  const [listStale, setListStale] = useState(false);
  const retryRefresh = useRetryAfter(refreshError);

  const all = guilds.data ?? [];
  const unclaimed = all.filter((guild) => !guild.claimed);
  const guildId = step?.guildId ?? null;
  const target = guildId === null ? null : (all.find((guild) => guild.id === guildId) ?? null);
  const direct = target !== null && target.has_moddy && !needsInvite;
  // The draft names a server the list has not brought yet.
  const waitingForTarget = step !== null && guildId !== null && target === null && guilds.isPending;

  useEffect(() => {
    if (!open || step === null) return undefined;
    return registerBeforeLogin(() => {
      const saved: ClaimDraft = {invite: direct ? '' : invite, guildId};
      void setItem(CLAIM_DRAFT_KEY, saved, 'session');
    });
  }, [open, step, direct, invite, guildId]);

  const choose = (next: Step) => {
    setStep(next);
    setInvite('');
    setError(null);
    setNeedsInvite(false);
  };

  const refreshRights = async (): Promise<RefreshGuildsResponse | undefined> => {
    setRefreshError(null);
    try {
      const result = await auth.run(() => refreshList.mutateAsync());
      if (!result) return undefined;
      setListStale(result.stale);
      return result;
    } catch (caught) {
      if (hasCode(caught, 'lineup_reauth_required')) reauth(caught);
      else setRefreshError(caught);
      return undefined;
    }
  };

  const refreshOnly = async () => {
    const result = await refreshRights();
    if (result && !result.stale) snackbar.show({message: t('refresh.done')});
  };

  const trimmed = invite.trim();
  const tooShort = trimmed.length > 0 && trimmed.length < FIELD_LIMITS.guild.inviteMin;

  const submit = async () => {
    setError(null);
    if (!direct && trimmed.length < FIELD_LIMITS.guild.inviteMin) {
      setError('local');
      return;
    }
    const body: ClaimGuildBody = direct
      ? {guild_id: target.id}
      : target
        ? {invite: trimmed, guild_id: target.id}
        : {invite: trimmed};
    try {
      const profile = await auth.run(() => claim.mutateAsync(body));
      if (!profile) return;
      snackbar.show({message: t('success', {name: profile.name ?? t('unknownName')})});
      onClose();
      void navigate(paths.guildManage(profile.id));
    } catch (caught) {
      if (hasCode(caught, 'invite_required')) setNeedsInvite(true);
      setError(caught);
    }
  };

  const retryAfterRights = async () => {
    const result = await refreshRights();
    if (result) await submit();
  };

  const inviteMessage = (): string | undefined => {
    if (error === 'local') return t('errors.tooShort', {count: FIELD_LIMITS.guild.inviteMin});
    if (!isApiError(error)) return undefined;
    if (error.code !== null && INVITE_CODES.includes(error.code)) return errorMessage(error, tErrors);
    return fieldErrors(error, tErrors).invite;
  };
  const inviteError = inviteMessage();
  const showAlert = error !== null && (direct || !inviteError) && error !== 'local';

  const name = target ? (target.name ?? t('unknownName')) : null;
  const inList = step === null || waitingForTarget;

  const claimStep = (
    <form
      className="servers-form"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      noValidate
    >
      <p>{target ? (direct ? t('dialog.introModdy', {name}) : t('dialog.intro', {name})) : t('dialog.introFree')}</p>
      {!direct && (
        <TextField
          label={t('dialog.label')}
          value={invite}
          onValueChange={(value) => {
            setInvite(value);
            if (error !== null) setError(null);
          }}
          placeholder={t('dialog.placeholder')}
          supportingText={t('dialog.hint')}
          errorText={inviteError}
          maxLength={FIELD_LIMITS.guild.inviteMax}
          autocomplete="off"
          inputMode="url"
          required
        />
      )}
      {showAlert && (
        <ClaimError
          error={error}
          onRefreshRights={() => void retryAfterRights()}
          rightsBusy={refreshList.isPending}
          onRetry={() => void submit()}
          stale={listStale}
        />
      )}
      {!direct && (
        <details className="servers-details">
          <summary>{t('dialog.how')}</summary>
          <InviteHelp hideTitle />
        </details>
      )}
    </form>
  );

  const listStep = (
    <div className="servers-form">
      {refreshError !== null && (
        <div className="servers-error" role="alert">
          <p>{errorMessage(refreshError, tErrors, {seconds: retryRefresh.seconds})}</p>
          {hasCode(refreshError, 'discord_unavailable') && (
            <RetryButton error={refreshError} onRetry={() => void refreshOnly()} busy={refreshList.isPending} />
          )}
        </div>
      )}
      {listStale && <StaleNotice />}
      {guilds.isPending && guilds.fetchStatus !== 'idle' ? (
        <Spinner />
      ) : guilds.isError ? (
        hasCode(guilds.error, 'lineup_reauth_required') ? (
          <EmptyState
            compact
            icon="lock_reset"
            title={t('list.reauthTitle')}
            action={
              <md-outlined-button onclick={() => reauth(guilds.error)}>{t('list.reauthAction')}</md-outlined-button>
            }
          >
            {t('list.reauthBody')}
          </EmptyState>
        ) : (
          <ErrorState compact error={guilds.error} onRetry={() => void guilds.refetch()} retrying={guilds.isFetching} />
        )
      ) : all.length === 0 ? (
        <EmptyState compact icon="groups" title={t('list.emptyTitle')}>
          {t('list.emptyBody')}
        </EmptyState>
      ) : unclaimed.length === 0 ? (
        <p className="servers-none">{t('toAdd.none')}</p>
      ) : (
        <ul className="servers-list" aria-label={t('toAdd.label')}>
          {unclaimed.map((guild) => (
            <li key={guild.id} className="servers-item inner-card">
              <GuildIcon id={guild.id} iconUrl={guild.icon_url} />
              <div className="servers-item-body">
                <strong className="servers-item-name">{guild.name ?? t('unknownName')}</strong>
                {guild.has_moddy && (
                  <span className="servers-item-meta servers-item-moddy">
                    <Icon name="check_circle" filled />
                    {t('toAdd.withModdy')}
                  </span>
                )}
              </div>
              <div className="servers-item-actions">
                <md-outlined-button onclick={() => choose({guildId: guild.id})}>{t('toAdd.add')}</md-outlined-button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="servers-foot">
        <md-text-button onclick={() => choose({guildId: null})}>{t('toAdd.withInvite')}</md-text-button>
        <div className="servers-refresh">
          {retryRefresh.active && (
            <span className="servers-refresh-wait">{t('refresh.in', {seconds: retryRefresh.seconds})}</span>
          )}
          <md-icon-button
            aria-label={t('refresh.label')}
            title={t('refresh.label')}
            disabled={refreshList.isPending || retryRefresh.active}
            onclick={() => void refreshOnly()}
          >
            <Icon name="refresh" />
          </md-icon-button>
        </div>
      </div>
    </div>
  );

  return (
    <Dialog
      className="servers-dialog"
      open={open}
      onClose={onClose}
      headline={target && !inList ? t('dialog.title', {name}) : t('menu.add')}
      actions={
        inList ? (
          <md-text-button {...AUTOFOCUS} onclick={onClose}>
            {t('dialog.close')}
          </md-text-button>
        ) : (
          <>
            <md-text-button onclick={() => choose(null)}>{t('dialog.back')}</md-text-button>
            <md-filled-button
              disabled={claim.isPending || !canWrite || (!direct && (tooShort || trimmed === ''))}
              onclick={() => void submit()}
            >
              {claim.isPending ? (direct ? t('dialog.adding') : t('dialog.submitting')) : t('dialog.submit')}
            </md-filled-button>
          </>
        )
      }
    >
      {inList ? listStep : claimStep}
    </Dialog>
  );
}

interface ClaimErrorProps {
  error: unknown;
  onRefreshRights: () => void;
  rightsBusy: boolean;
  onRetry: () => void;
  stale: boolean;
}

/** Every refusal that is not about the invitation field itself, with what to do next. */
function ClaimError({error, onRefreshRights, rightsBusy, onRetry, stale}: ClaimErrorProps) {
  const {t} = useT('claim');
  const {t: tErrors} = useT('errors');
  const retry = useRetryAfter(error);

  if (hasCode(error, 'guild_suspended') && isApiError(error)) return <SanctionNotice error={error} />;

  const message = errorMessage(error, tErrors, {context: 'claim', seconds: retry.seconds});
  const guildId = hasCode(error, 'lineup_guild_already_claimed') ? error.context.guild_id : undefined;

  return (
    <div className="servers-error" role="alert">
      <p>
        <Icon name="error" filled />
        <span>{message}</span>
      </p>
      {hasCode(error, 'lineup_guild_forbidden') && (
        <>
          <p className="servers-error-help">{t('errors.forbiddenHelp')}</p>
          {stale && <StaleNotice />}
          <CardActions>
            <md-outlined-button disabled={rightsBusy} onclick={onRefreshRights}>
              <md-icon slot="icon" className="filled" aria-hidden="true">
                sync
              </md-icon>
              {rightsBusy ? t('errors.rightsChecking') : t('errors.rightsChanged')}
            </md-outlined-button>
          </CardActions>
        </>
      )}
      {typeof guildId === 'string' && (
        <CardActions>
          <LinkButton to={paths.guild(guildId)} variant="outlined" icon="groups">
            {t('errors.openProfile')}
          </LinkButton>
        </CardActions>
      )}
      {hasCode(error, 'discord_unavailable') && (
        <CardActions>
          <RetryButton error={error} onRetry={onRetry} />
        </CardActions>
      )}
    </div>
  );
}
