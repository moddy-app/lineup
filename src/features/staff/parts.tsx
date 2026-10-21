/** Pieces shared by the four sections: list states, the action dialog, a person's link. */

import {type ReactNode, useState} from 'react';
import {Link} from 'react-router';

import {hasCode} from '@/api/client';
import {errorMessage, fieldErrors} from '@/api/errors';
import {useUser} from '@/api/queries';
import {formatCountdown, useRetryAfter} from '@/api/useRetryAfter';
import type {InfiniteList} from '@/api/pagination';
import {paths} from '@/app/paths';
import {useSession} from '@/auth/session';
import {useAuthAction} from '@/auth/useAuthAction';
import {EmptyState, ErrorState, RetryButton, UserAvatar} from '@/components';
import {useT} from '@/i18n/useT';
import {Dialog, Icon, Pill, Spinner, TextField, useSnackbar} from '@/ui';

// ---------------------------------------------------------------------------
// Lists
// ---------------------------------------------------------------------------

/** A failed read. `403 Staff only` should not happen (the route is guarded) but reads as a locked door, not an outage. */
export function StaffListError({error, onRetry, retrying}: {error: unknown; onRetry: () => void; retrying?: boolean}) {
  const {t} = useT('staff');
  if (hasCode(error, 'staff_only')) {
    return (
      <EmptyState compact icon="lock" shape="diamond" tone="tertiary" title={t('forbidden.title')}>
        {t('forbidden.text')}
      </EmptyState>
    );
  }
  return <ErrorState compact error={error} onRetry={onRetry} retrying={retrying} />;
}

interface ListBodyProps<T> {
  list: InfiniteList<T>;
  emptyTitle: string;
  emptyText: string;
  emptyIcon: string;
  children: ReactNode;
}

/** Loading, error with retry, empty, then the items and a "Load more" while a cursor remains. */
export function ListBody<T>({list, emptyTitle, emptyText, emptyIcon, children}: ListBodyProps<T>) {
  const {t: tCommon} = useT('common');
  if (list.isLoading) return <Spinner />;
  if (list.isError) return <StaffListError error={list.error} onRetry={list.refetch} retrying={list.isRefetching} />;
  if (list.isEmpty) {
    return (
      <EmptyState compact icon={emptyIcon} title={emptyTitle}>
        {emptyText}
      </EmptyState>
    );
  }
  return (
    <>
      {children}
      {list.isLoadMoreError ? (
        <div className="staff-more">
          <RetryButton onRetry={list.loadMore} error={list.error} busy={list.isLoadingMore} />
        </div>
      ) : list.isLoadingMore ? (
        <Spinner />
      ) : (
        list.hasMore && (
          <div className="staff-more">
            <md-outlined-button onclick={list.loadMore}>{tCommon('actions.loadMore')}</md-outlined-button>
          </div>
        )
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// A person
// ---------------------------------------------------------------------------

/** Avatar, a link to the profile and the id in a mono pill. With `lookup`, the name is read from the profile. */
export function PersonLink({id, lookup}: {id: string; lookup?: boolean}) {
  const {t} = useT('staff');
  return lookup ? (
    <LookedUpPerson id={id} label={t('person.profile')} />
  ) : (
    <PersonRow id={id} label={t('person.profile')} />
  );
}

function LookedUpPerson({id, label}: {id: string; label: string}) {
  const {data} = useUser(id);
  const name = data ? (data.display_name ?? data.global_name ?? data.username) : null;
  return <PersonRow id={id} label={name ?? label} avatar={data?.avatar_url} />;
}

function PersonRow({id, label, avatar}: {id: string; label: string; avatar?: string | null}) {
  return (
    <span className="staff-person">
      <UserAvatar id={id} src={avatar} size="small" />
      <Link to={paths.user(id)} className="staff-person-name">
        {label}
      </Link>
      <Pill>{id}</Pill>
    </span>
  );
}

// ---------------------------------------------------------------------------
// The action dialog
// ---------------------------------------------------------------------------

export interface ActionField {
  /** The API field, to put a 422 on it. */
  name: 'reason' | 'note';
  label: string;
  required: boolean;
  maxLength: number;
}

interface ActionDialogProps {
  open: boolean;
  onClose: () => void;
  headline: string;
  intro?: ReactNode;
  field?: ActionField;
  confirmLabel: string;
  destructive?: boolean;
  /** Does the write. A rejection stays in the dialog as a sentence; success closes it. */
  onSubmit: (text: string) => Promise<unknown>;
  /** Called with the error of a failed write (to reload a list that went stale). */
  onFailure?: (error: unknown) => void;
  successMessage?: string;
}

/**
 * One dialog for every staff write: an optional text (a note, or a reason that
 * cannot be empty), a confirm button, the failure in words, the wait after a 429.
 */
export function ActionDialog({
  open,
  onClose,
  headline,
  intro,
  field,
  confirmLabel,
  destructive,
  onSubmit,
  onFailure,
  successMessage,
}: ActionDialogProps) {
  const {t} = useT('staff');
  const {t: tCommon} = useT('common');
  const {t: tErrors} = useT('errors');
  const {canWrite} = useSession();
  const auth = useAuthAction();
  const snackbar = useSnackbar();
  const [text, setText] = useState('');
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [wasOpen, setWasOpen] = useState(open);
  const retry = useRetryAfter(error);

  // Each opening starts clean (state adjusted while rendering, not in an effect).
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setText('');
      setMissing(false);
      setError(null);
      setBusy(false);
    }
  }

  const fieldError = field ? fieldErrors(error, tErrors)[field.name] : undefined;
  const limited = hasCode(error, 'lineup_rate_limited');
  const message =
    error === null || fieldError
      ? null
      : errorMessage(error, tErrors, limited && !retry.active ? {seconds: 0} : undefined);

  async function submit() {
    const value = text.trim();
    if (field?.required && value === '') {
      setMissing(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await auth.run(() => onSubmit(value));
      if (successMessage) snackbar.show({message: successMessage});
      onClose();
    } catch (failure) {
      setError(failure);
      onFailure?.(failure);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      type="alert"
      // The dialog's own `close` event arrives after its animation: by then it may be shut already.
      onClose={() => open && onClose()}
      className="staff-dialog"
      headline={headline}
      actions={
        <>
          <md-text-button disabled={busy} onclick={onClose}>
            {tCommon('actions.cancel')}
          </md-text-button>
          <md-filled-button
            className={destructive ? 'destructive' : undefined}
            disabled={busy || retry.active || !canWrite}
            onclick={() => void submit()}
          >
            {retry.active ? t('retryIn', {wait: formatCountdown(retry.seconds)}) : confirmLabel}
          </md-filled-button>
        </>
      }
    >
      <div className="staff-dialog-body">
        {intro && <p>{intro}</p>}
        {field && (
          <TextField
            label={field.label}
            value={text}
            onValueChange={(value) => {
              setText(value);
              setMissing(false);
            }}
            rows={3}
            maxLength={field.maxLength}
            required={field.required}
            disabled={busy}
            errorText={missing ? t('dialog.required') : fieldError}
          />
        )}
        {message && (
          <p className="staff-error" role="alert">
            <Icon name="error" filled />
            {message}
          </p>
        )}
      </div>
    </Dialog>
  );
}
