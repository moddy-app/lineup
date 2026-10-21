import {useEffect, useState} from 'react';
import {useNavigate} from 'react-router';

import {hasCode, isApiError} from '@/api/client';
import {errorMessage, fieldErrors} from '@/api/errors';
import {FIELD_LIMITS} from '@/api/limits';
import {useClaimGuild, useRefreshMyGuilds} from '@/api/mutations';
import {useGuild, useMyGuilds} from '@/api/queries';
import type {MyGuild, RefreshGuildsResponse} from '@/api/types';
import {useRetryAfter} from '@/api/useRetryAfter';
import {paths} from '@/app/paths';
import {usePageTitle} from '@/app/usePageTitle';
import {registerBeforeLogin} from '@/auth/beforeLogin';
import {useReauthenticate} from '@/auth/reauth';
import {useSession} from '@/auth/session';
import {useAuthAction} from '@/auth/useAuthAction';
import {DisplayName, EmptyState, ErrorState, GuildIcon, InviteHelp, RetryButton, StaleNotice} from '@/components';
import {useT} from '@/i18n/useT';
import {getItem, removeItem, setItem} from '@/lib/storage';
import {
  CardActions,
  Dialog,
  Icon,
  LinkButton,
  SettingsLayout,
  SettingsPanel,
  Spinner,
  TextField,
  useSnackbar,
} from '@/ui';
import {SanctionNotice} from '../guilds/SanctionNotice';

import {CLAIM_DRAFT_KEY, type ClaimDraft, parseClaimDraft} from './claimDraft';
import './claim.css';

/** These land on the invitation field itself. */
const INVITE_CODES = ['invite_invalid', 'invite_not_found', 'invite_expiring', 'invite_guild_mismatch'];

/** The dialog: a number to start it afresh at each opening, the server it targets, an invitation to start from. */
interface DialogState {
  run: number;
  open: boolean;
  guildId: string | null;
  invite: string;
}

export function Component() {
  const {t} = useT('claim');
  const {t: tErrors} = useT('errors');
  usePageTitle(t('title'));
  const snackbar = useSnackbar();
  const auth = useAuthAction();
  const reauth = useReauthenticate();

  const guilds = useMyGuilds();
  const refreshList = useRefreshMyGuilds();

  // Signing in leaves the page: the dialog comes back with what was typed.
  const [dialog, setDialog] = useState<DialogState>(() => {
    const draft = parseClaimDraft(getItem<unknown>(CLAIM_DRAFT_KEY, null, 'session'));
    removeItem(CLAIM_DRAFT_KEY, 'session');
    return {run: 1, open: draft !== null, guildId: draft?.guildId ?? null, invite: draft?.invite ?? ''};
  });
  const [refreshError, setRefreshError] = useState<unknown>(null);
  const [listStale, setListStale] = useState(false);
  const retryRefresh = useRetryAfter(refreshError);

  const openDialog = (guildId: string | null) =>
    setDialog((current) => ({run: current.run + 1, open: true, guildId, invite: ''}));

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

  const all = guilds.data ?? [];
  const claimed = all.filter((guild) => guild.claimed);
  const unclaimed = all.filter((guild) => !guild.claimed);
  const target = dialog.guildId === null ? null : (all.find((guild) => guild.id === dialog.guildId) ?? null);

  const refreshAction = (
    <div className="claim-refresh">
      {retryRefresh.active && (
        <span className="claim-refresh-wait">{t('refresh.in', {seconds: retryRefresh.seconds})}</span>
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
  );

  return (
    <SettingsLayout title={t('title')} description={t('description')} actions={refreshAction}>
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
      ) : (
        <>
          {refreshError !== null && (
            <div className="claim-inline-error" role="alert">
              <p>{errorMessage(refreshError, tErrors, {seconds: retryRefresh.seconds})}</p>
              {hasCode(refreshError, 'discord_unavailable') && (
                <RetryButton error={refreshError} onRetry={() => void refreshOnly()} busy={refreshList.isPending} />
              )}
            </div>
          )}
          {listStale && <StaleNotice />}
          {all.length === 0 ? (
            <EmptyState
              compact
              icon="groups"
              title={t('list.emptyTitle')}
              action={<md-outlined-button onclick={() => openDialog(null)}>{t('toAdd.withInvite')}</md-outlined-button>}
            >
              {t('list.emptyBody')}
            </EmptyState>
          ) : (
            <>
              {claimed.length > 0 && (
                <SettingsPanel title={t('onLineup.title')}>
                  <ul className="claim-list" aria-label={t('onLineup.label')}>
                    {claimed.map((guild) => (
                      <ClaimedRow key={guild.id} guild={guild} />
                    ))}
                  </ul>
                </SettingsPanel>
              )}
              <SettingsPanel
                title={t('toAdd.title')}
                actions={
                  <md-outlined-button onclick={() => openDialog(null)}>{t('toAdd.withInvite')}</md-outlined-button>
                }
              >
                {unclaimed.length === 0 ? (
                  <p className="claim-none">{t('toAdd.none')}</p>
                ) : (
                  <ul className="claim-list" aria-label={t('toAdd.label')}>
                    {unclaimed.map((guild) => (
                      <li key={guild.id} className="claim-item inner-card">
                        <GuildIcon id={guild.id} iconUrl={guild.icon_url} />
                        <div className="claim-item-body">
                          <strong className="claim-item-name">{guild.name ?? t('unknownName')}</strong>
                          {guild.has_moddy && (
                            <span className="claim-item-meta claim-item-moddy">
                              <Icon name="check_circle" filled />
                              {t('toAdd.withModdy')}
                            </span>
                          )}
                        </div>
                        <div className="claim-item-actions">
                          <md-outlined-button onclick={() => openDialog(guild.id)}>{t('toAdd.add')}</md-outlined-button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </SettingsPanel>
            </>
          )}
        </>
      )}
      <ClaimDialog
        key={dialog.run}
        open={dialog.open}
        target={target}
        initialInvite={dialog.invite}
        onClose={() => setDialog((current) => ({...current, open: false}))}
        refreshRights={refreshRights}
        rightsBusy={refreshList.isPending}
        rightsStale={listStale}
      />
    </SettingsLayout>
  );
}

/** A server already on Lineup: its name (with the verification mark), whether it is listed, and the two ways in. */
function ClaimedRow({guild}: {guild: MyGuild}) {
  const {t} = useT('claim');
  const profile = useGuild(guild.id).data;
  return (
    <li className="claim-item inner-card">
      <GuildIcon id={guild.id} iconUrl={guild.icon_url} />
      <div className="claim-item-body">
        <DisplayName
          as="strong"
          className="claim-item-name"
          name={profile?.name ?? guild.name ?? t('unknownName')}
          badges={profile?.badges}
          entity="guild"
        />
        {profile && (
          <span className="claim-item-meta">
            <Icon name={profile.listed ? 'visibility' : 'visibility_off'} filled />
            {profile.listed ? t('onLineup.listed') : t('onLineup.unlisted')}
          </span>
        )}
      </div>
      <div className="claim-item-actions">
        <LinkButton to={paths.guild(guild.id)} variant="text">
          {t('onLineup.profile')}
        </LinkButton>
        <LinkButton to={paths.guildManage(guild.id)} variant="outlined">
          {t('onLineup.manage')}
        </LinkButton>
      </div>
    </li>
  );
}

interface ClaimDialogProps {
  open: boolean;
  /** The server chosen in the list; null: the free invitation field. */
  target: MyGuild | null;
  initialInvite: string;
  onClose: () => void;
  refreshRights: () => Promise<RefreshGuildsResponse | undefined>;
  rightsBusy: boolean;
  rightsStale: boolean;
}

/** Claiming a server needs an invitation that never expires: this dialog asks for it. */
function ClaimDialog({open, target, initialInvite, onClose, refreshRights, rightsBusy, rightsStale}: ClaimDialogProps) {
  const {t} = useT('claim');
  const {t: tErrors} = useT('errors');
  const navigate = useNavigate();
  const snackbar = useSnackbar();
  const auth = useAuthAction();
  const {canWrite} = useSession();
  const claim = useClaimGuild();

  const [invite, setInvite] = useState(initialInvite);
  const [error, setError] = useState<unknown>(null);
  const guildId = target?.id ?? null;

  // Signing in leaves the page: keep what was typed, and the server it was for.
  useEffect(() => {
    if (!open) return undefined;
    return registerBeforeLogin(() => {
      const draft: ClaimDraft = {invite, guildId};
      void setItem(CLAIM_DRAFT_KEY, draft, 'session');
    });
  }, [open, invite, guildId]);

  const trimmed = invite.trim();
  const tooShort = trimmed.length > 0 && trimmed.length < FIELD_LIMITS.guild.inviteMin;

  const submit = async () => {
    setError(null);
    if (trimmed.length < FIELD_LIMITS.guild.inviteMin) {
      setError('local');
      return;
    }
    try {
      const profile = await auth.run(() => claim.mutateAsync({invite: trimmed}));
      if (!profile) return;
      snackbar.show({message: t('success', {name: profile.name ?? t('unknownName')})});
      void navigate(paths.guildManage(profile.id));
    } catch (caught) {
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
  const showAlert = error !== null && !inviteError && error !== 'local';

  const name = target ? (target.name ?? t('unknownName')) : null;
  const intro = target
    ? target.has_moddy
      ? t('dialog.introModdy', {name})
      : t('dialog.intro', {name})
    : t('dialog.introFree');

  return (
    <Dialog
      open={open}
      onClose={onClose}
      headline={target ? t('dialog.title', {name}) : t('dialog.titleFree')}
      actions={
        <>
          <md-text-button onclick={onClose}>{t('dialog.cancel')}</md-text-button>
          <md-filled-button
            disabled={claim.isPending || !canWrite || tooShort || trimmed === ''}
            onclick={() => void submit()}
          >
            {claim.isPending ? t('dialog.submitting') : t('dialog.submit')}
          </md-filled-button>
        </>
      }
    >
      <form
        className="claim-form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        noValidate
      >
        <p className="claim-dialog-intro">{intro}</p>
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
        {showAlert && (
          <ClaimError
            error={error}
            onRefreshRights={() => void retryAfterRights()}
            rightsBusy={rightsBusy}
            onRetry={() => void submit()}
            stale={rightsStale}
          />
        )}
        <details className="claim-details">
          <summary>{t('dialog.how')}</summary>
          <InviteHelp hideTitle />
        </details>
      </form>
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
    <div className="claim-error" role="alert">
      <p>
        <Icon name="error" filled />
        <span>{message}</span>
      </p>
      {hasCode(error, 'lineup_guild_forbidden') && (
        <>
          <p className="claim-error-help">{t('errors.forbiddenHelp')}</p>
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
