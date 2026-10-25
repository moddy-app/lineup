import {useEffect, useState} from 'react';
import {useNavigate} from 'react-router';

import {hasCode, isApiError} from '@/api/client';
import {errorMessage} from '@/api/errors';
import {useClaimBot} from '@/api/mutations';
import {useBotLookup} from '@/api/queries';
import {formatCountdown, useRetryAfter} from '@/api/useRetryAfter';
import {paths} from '@/app/paths';
import {registerBeforeLogin} from '@/auth/beforeLogin';
import {useSession} from '@/auth/session';
import {useAuthAction} from '@/auth/useAuthAction';
import {BotLookupPreview, RetryButton} from '@/components';
import {SanctionNotice} from '@/components/SanctionNotice';
import {useT} from '@/i18n/useT';
import {getItem, removeItem, setItem} from '@/lib/storage';
import {CardActions, Dialog, Icon, LinkButton, Spinner, TextField, useSnackbar} from '@/ui';

import {BOT_CLAIM_DRAFT_KEY, parseBotClaimDraft} from './claimDraft';
import {isApplicationId} from './botId';
import './claim.css';

/** md-dialog focuses the element marked `autofocus` (not the first button of the content). */
const AUTOFOCUS: object = {autofocus: true};

/** These land on the Application ID field itself. */
const FIELD_CODES = ['bot_not_found', 'bot_not_discoverable', 'bot_support_guild_missing'];

/**
 * "Add a bot": the Application ID, the preview of the bot (`lookup`, only when
 * the person asks: 20 per minute), then the claim when the person administers
 * its support server. The two conditions of Discord are said up front.
 * Mounted afresh at each opening.
 */
export function AddBotDialog({open, onClose}: {open: boolean; onClose: () => void}) {
  const {t} = useT('bots');
  const {t: tErrors} = useT('errors');
  const navigate = useNavigate();
  const snackbar = useSnackbar();
  const auth = useAuthAction();
  const {canWrite} = useSession();
  const claim = useClaimBot();

  const [draft] = useState(() => parseBotClaimDraft(getItem<unknown>(BOT_CLAIM_DRAFT_KEY, null, 'session')));
  useEffect(() => removeItem(BOT_CLAIM_DRAFT_KEY, 'session'), []);
  const [value, setValue] = useState(draft ?? '');
  const [asked, setAsked] = useState<string | null>(draft && isApplicationId(draft) ? draft.trim() : null);
  const [localError, setLocalError] = useState(false);
  const [claimError, setClaimError] = useState<unknown>(null);

  const lookup = useBotLookup(asked);
  const lookupWait = useRetryAfter(lookup.error);
  const preview = lookup.data && lookup.data.id === asked ? lookup.data : null;

  useEffect(() => {
    if (!open) return undefined;
    return registerBeforeLogin(() => void setItem(BOT_CLAIM_DRAFT_KEY, value, 'session'));
  }, [open, value]);

  const search = () => {
    setClaimError(null);
    const id = value.trim();
    if (!isApplicationId(id)) {
      setLocalError(true);
      return;
    }
    setLocalError(false);
    if (id === asked) void lookup.refetch();
    else setAsked(id);
  };

  const submitClaim = async () => {
    if (!preview) return;
    setClaimError(null);
    try {
      const profile = await auth.run(() => claim.mutateAsync(preview.id));
      if (!profile) return;
      snackbar.show({message: t('claim.success', {name: profile.name ?? t('unknownName')})});
      onClose();
      void navigate(paths.botManage(profile.id));
    } catch (caught) {
      setClaimError(caught);
    }
  };

  const fieldError = localError
    ? t('claim.idInvalid')
    : lookup.isError &&
        isApiError(lookup.error) &&
        lookup.error.code !== null &&
        FIELD_CODES.includes(lookup.error.code)
      ? errorMessage(lookup.error, tErrors)
      : undefined;
  const lookupAlert = lookup.isError && !fieldError ? lookup.error : null;
  const searching = lookup.isFetching;

  return (
    <Dialog
      className="servers-dialog"
      open={open}
      onClose={onClose}
      headline={t('claim.title')}
      actions={
        <>
          <md-text-button {...(preview ? {} : AUTOFOCUS)} onclick={onClose}>
            {t('claim.close')}
          </md-text-button>
          {preview?.can_claim ? (
            <md-filled-button disabled={claim.isPending || !canWrite} onclick={() => void submitClaim()}>
              {claim.isPending ? t('claim.claiming') : t('claim.submit')}
            </md-filled-button>
          ) : (
            <md-filled-button disabled={searching || lookupWait.active || value.trim() === ''} onclick={search}>
              {lookupWait.active
                ? t('claim.searchIn', {wait: formatCountdown(lookupWait.seconds)})
                : searching
                  ? t('claim.searching')
                  : t('claim.search')}
            </md-filled-button>
          )}
        </>
      }
    >
      <form
        className="servers-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          search();
        }}
      >
        <p>{t('claim.intro')}</p>
        <ul className="bot-conditions">
          <li>
            <Icon name="travel_explore" filled />
            <span>{t('claim.conditionDiscoverable')}</span>
          </li>
          <li>
            <Icon name="support_agent" filled />
            <span>{t('claim.conditionSupport')}</span>
          </li>
          <li>
            <Icon name="admin_panel_settings" filled />
            <span>{t('claim.conditionAdmin')}</span>
          </li>
        </ul>
        <TextField
          label={t('claim.idLabel')}
          value={value}
          onValueChange={(next) => {
            setValue(next);
            if (localError) setLocalError(false);
          }}
          supportingText={t('claim.idHint')}
          errorText={fieldError}
          inputMode="numeric"
          autocomplete="off"
          maxLength={24}
          required
        />

        {searching && !preview && <Spinner />}
        {lookupAlert !== null && (
          <div className="servers-error" role="alert">
            <p>
              <Icon name="error" filled />
              <span>{errorMessage(lookupAlert, tErrors, {seconds: lookupWait.seconds})}</span>
            </p>
            {hasCode(lookupAlert, 'discord_unavailable') && (
              <RetryButton error={lookupAlert} onRetry={() => void lookup.refetch()} busy={searching} />
            )}
          </div>
        )}

        {preview && (
          <>
            <BotLookupPreview bot={preview} />
            {preview.claimed ? (
              <div className="servers-error" role="status">
                <p>
                  <Icon name="info" filled />
                  <span>{t('claim.claimed')}</span>
                </p>
                <CardActions>
                  <LinkButton to={paths.bot(preview.id)} variant="outlined" icon="smart_toy">
                    {t('claim.openProfile')}
                  </LinkButton>
                </CardActions>
              </div>
            ) : !preview.can_claim ? (
              <div className="servers-error" role="status">
                <p>
                  <Icon name="lock" filled />
                  <span>
                    {t('claim.notAdmin', {name: preview.support_guild?.name ?? preview.support_guild?.id ?? ''})}
                  </span>
                </p>
                <p className="servers-error-help">{t('claim.notAdminHelp')}</p>
              </div>
            ) : null}
          </>
        )}

        {claimError !== null && <ClaimBotError error={claimError} onRetry={() => void submitClaim()} />}
      </form>
    </Dialog>
  );
}

/** Every refusal of `POST /lineup/bots/claim`, with what to do next. */
function ClaimBotError({error, onRetry}: {error: unknown; onRetry: () => void}) {
  const {t} = useT('bots');
  const {t: tErrors} = useT('errors');
  const retry = useRetryAfter(error);
  if (hasCode(error, 'guild_suspended') && isApiError(error)) return <SanctionNotice error={error} />;
  const botId = hasCode(error, 'lineup_bot_already_claimed') ? error.context.bot_id : undefined;
  return (
    <div className="servers-error" role="alert">
      <p>
        <Icon name="error" filled />
        <span>{errorMessage(error, tErrors, {seconds: retry.seconds})}</span>
      </p>
      {hasCode(error, 'lineup_bot_forbidden') && <p className="servers-error-help">{t('claim.notAdminHelp')}</p>}
      {typeof botId === 'string' && (
        <CardActions>
          <LinkButton to={paths.bot(botId)} variant="outlined" icon="smart_toy">
            {t('claim.openProfile')}
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
