import {useEffect, useRef, useState} from 'react';
import {useNavigate} from 'react-router';

import {hasCode, isApiError} from '@/api/client';
import {errorMessage, fieldErrors} from '@/api/errors';
import {FIELD_LIMITS} from '@/api/limits';
import {useClaimGuild, useRefreshMyGuilds} from '@/api/mutations';
import {useMyGuilds} from '@/api/queries';
import type {MyGuild} from '@/api/types';
import {useRetryAfter} from '@/api/useRetryAfter';
import {paths} from '@/app/paths';
import {usePageTitle} from '@/app/usePageTitle';
import {registerBeforeLogin} from '@/auth/beforeLogin';
import {useReauthenticate} from '@/auth/reauth';
import {useSession} from '@/auth/session';
import {useAuthAction} from '@/auth/useAuthAction';
import {EmptyState, ErrorState, GuildIcon, InviteHelp, RetryButton, StaleNotice} from '@/components';
import {useT} from '@/i18n/useT';
import {getItem, removeItem, setItem} from '@/lib/storage';
import {
  AppLayout,
  Card,
  CardActions,
  Icon,
  LinkButton,
  Panel,
  Row,
  RowBody,
  Rows,
  Section,
  Spinner,
  Status,
  TextField,
  useSnackbar,
} from '@/ui';
import {SanctionNotice} from '../guilds/SanctionNotice';

import './claim.css';

const DRAFT_KEY = 'claim-invite';
/** These land on the invitation field itself. */
const INVITE_CODES = ['invite_invalid', 'invite_not_found', 'invite_expiring'];

export function Component() {
  const {t} = useT('claim');
  const {t: tErrors} = useT('errors');
  usePageTitle(t('title'));
  const navigate = useNavigate();
  const snackbar = useSnackbar();
  const auth = useAuthAction();
  const {canWrite} = useSession();
  const reauth = useReauthenticate();

  const guilds = useMyGuilds();
  const refreshList = useRefreshMyGuilds();
  const claim = useClaimGuild();

  const [invite, setInvite] = useState(() => {
    const saved = getItem<string>(DRAFT_KEY, '', 'session');
    removeItem(DRAFT_KEY, 'session');
    return saved;
  });
  const [selected, setSelected] = useState<MyGuild | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [refreshError, setRefreshError] = useState<unknown>(null);
  const [listStale, setListStale] = useState(false);
  const [rightsRefreshed, setRightsRefreshed] = useState<'stale' | 'ok' | null>(null);
  const field = useRef<HTMLElement | null>(null);
  const retryRefresh = useRetryAfter(refreshError);

  // Signing in leaves the page: keep what was typed.
  useEffect(() => registerBeforeLogin(() => void setItem(DRAFT_KEY, invite, 'session')), [invite]);

  const trimmed = invite.trim();
  const tooShort = trimmed.length > 0 && trimmed.length < FIELD_LIMITS.guild.inviteMin;

  const submit = async () => {
    setError(null);
    setRightsRefreshed(null);
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

  const refreshRights = async () => {
    setRefreshError(null);
    try {
      const result = await auth.run(() => refreshList.mutateAsync());
      if (!result) return;
      setListStale(result.stale);
      setRightsRefreshed(result.stale ? 'stale' : 'ok');
      return result;
    } catch (caught) {
      if (hasCode(caught, 'lineup_reauth_required')) reauth(caught);
      else setRefreshError(caught);
    }
  };

  const refreshOnly = async () => {
    const result = await refreshRights();
    if (result && !result.stale) snackbar.show({message: t('list.refreshed')});
  };

  const retryAfterRights = async () => {
    const result = await refreshRights();
    if (result) await submit();
  };

  const choose = (guild: MyGuild) => {
    setSelected(guild);
    setError(null);
    const element = field.current;
    element?.scrollIntoView({block: 'center', behavior: 'smooth'});
    window.setTimeout(() => element?.focus(), 250);
  };

  const inviteMessage = (): string | undefined => {
    if (error === 'local') return t('errors.tooShort', {count: FIELD_LIMITS.guild.inviteMin});
    if (!isApiError(error)) return undefined;
    if (error.code !== null && INVITE_CODES.includes(error.code)) return errorMessage(error, tErrors);
    return fieldErrors(error, tErrors).invite;
  };
  const inviteError = inviteMessage();
  const showAlert = error !== null && !inviteError && error !== 'local';

  return (
    <AppLayout
      aside={
        <Section title={t('form.title')}>
          <p>{t('form.body')}</p>
          {selected && (
            <p className="claim-selected" role="status">
              <GuildIcon id={selected.id} iconUrl={selected.icon_url} size="small" />
              <span>{t('form.selected', {name: selected.name ?? t('unknownName')})}</span>
              <md-text-button onclick={() => setSelected(null)}>{t('form.deselect')}</md-text-button>
            </p>
          )}
          <form
            className="claim-form"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
            noValidate
          >
            <TextField
              ref={(element) => {
                field.current = element;
              }}
              label={t('form.label')}
              value={invite}
              onValueChange={(value) => {
                setInvite(value);
                if (error !== null) setError(null);
              }}
              placeholder={t('form.placeholder')}
              supportingText={t('form.hint')}
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
                rightsBusy={refreshList.isPending}
                onRetry={() => void submit()}
                stale={rightsRefreshed === 'stale'}
              />
            )}
            <CardActions>
              <md-filled-button type="submit" disabled={claim.isPending || !canWrite || tooShort || trimmed === ''}>
                {claim.isPending ? t('form.submitting') : t('form.submit')}
              </md-filled-button>
            </CardActions>
          </form>
          <Panel className="claim-help">
            <InviteHelp headingLevel={3} />
          </Panel>
        </Section>
      }
    >
      <Card as="section" className="claim-intro">
        <h1>{t('title')}</h1>
        <p>{t('intro')}</p>
      </Card>

      <Section
        title={t('list.title')}
        actions={
          <md-text-button disabled={refreshList.isPending || retryRefresh.active} onclick={() => void refreshOnly()}>
            <md-icon slot="icon" className="filled" aria-hidden="true">
              refresh
            </md-icon>
            {retryRefresh.active ? t('list.refreshIn', {seconds: retryRefresh.seconds}) : t('list.refresh')}
          </md-text-button>
        }
      >
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
            <ErrorState
              compact
              error={guilds.error}
              onRetry={() => void guilds.refetch()}
              retrying={guilds.isFetching}
            />
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
            {(guilds.data ?? []).length === 0 ? (
              <EmptyState compact icon="groups" title={t('list.emptyTitle')}>
                {t('list.emptyBody')}
              </EmptyState>
            ) : (
              <Rows as="ul" aria-label={t('list.label')}>
                {(guilds.data ?? []).map((guild) => (
                  <Row key={guild.id} className="claim-row">
                    <GuildIcon id={guild.id} iconUrl={guild.icon_url} />
                    <RowBody
                      title={<strong>{guild.name ?? t('unknownName')}</strong>}
                      meta={guild.has_moddy ? t('list.withModdy') : t('list.withoutModdy')}
                    />
                    {guild.claimed ? (
                      <>
                        <Status variant="accent">{t('list.claimed')}</Status>
                        <div className="claim-row-actions">
                          <LinkButton to={paths.guild(guild.id)} variant="text">
                            {t('list.profile')}
                          </LinkButton>
                          <LinkButton to={paths.guildManage(guild.id)} variant="outlined">
                            {t('list.manage')}
                          </LinkButton>
                        </div>
                      </>
                    ) : (
                      <div className="claim-row-actions">
                        <md-outlined-button onclick={() => choose(guild)}>{t('list.claim')}</md-outlined-button>
                      </div>
                    )}
                  </Row>
                ))}
              </Rows>
            )}
          </>
        )}
      </Section>
    </AppLayout>
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
