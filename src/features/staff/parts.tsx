/** Pieces shared by the four sections: list states, the action dialog, a person's link. */

import {type ReactNode, useState} from 'react';
import {Link} from 'react-router';

import {hasCode} from '@/api/client';
import {errorMessage, fieldErrors} from '@/api/errors';
import {useBot, useGuild, useUser} from '@/api/queries';
import {formatCountdown, useRetryAfter} from '@/api/useRetryAfter';
import type {InfiniteList} from '@/api/pagination';
import {paths} from '@/app/paths';
import {useSession} from '@/auth/session';
import {useAuthAction} from '@/auth/useAuthAction';
import {DisplayName, EmptyState, ErrorState, RetryButton, UserAvatar} from '@/components';
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
// Section head, status chips, rules
// ---------------------------------------------------------------------------

/** The head of a section: its title (h2) and, under it, the selectable status chips. */
export function SectionHead({title, children}: {title: string; children?: ReactNode}) {
  return (
    <div className="staff-section-head">
      <h2 className="staff-section-title">{title}</h2>
      {children}
    </div>
  );
}

interface StatusChipsProps<T extends string> {
  label: string;
  value: T;
  options: ReadonlyArray<{value: T; label: string}>;
  onChange: (value: T) => void;
}

/** Small selectable chips (one pressed at a time) for the status or entity filter. */
export function StatusChips<T extends string>({label, value, options, onChange}: StatusChipsProps<T>) {
  return (
    <div className="staff-chips" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="staff-chip"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** The rules of a section: folded, a few lines. */
export function Rules({title, children}: {title: string; children: ReactNode}) {
  return (
    <details className="staff-rules">
      <summary>{title}</summary>
      <ul>{children}</ul>
    </details>
  );
}

// ---------------------------------------------------------------------------
// People and servers
// ---------------------------------------------------------------------------

/** Avatar and name (with its verification mark) linking to the profile. With `showId`, the id in a pill. */
export function PersonLink({id, showId}: {id: string; showId?: boolean}) {
  const {t} = useT('staff');
  const {data} = useUser(id);
  const name = data ? (data.display_name ?? data.global_name ?? data.username) : null;
  return (
    <span className="staff-person">
      <UserAvatar id={id} src={data?.avatar_url} size="small" />
      <Link to={paths.user(id)} className="staff-person-name">
        <DisplayName name={name ?? t('person.profile')} badges={data?.badges} entity="user" focusable={false} />
      </Link>
      {showId && <Pill>{id}</Pill>}
    </span>
  );
}

/** The name of a server or a person read from its profile, linking to it; the id while it loads. */
export function EntityName({type, id}: {type: 'user' | 'guild' | 'bot'; id: string}) {
  if (type === 'bot') return <BotLink id={id} />;
  return type === 'user' ? <PersonLink id={id} /> : <GuildLink id={id} />;
}

function BotLink({id}: {id: string}) {
  const {data} = useBot(id);
  return (
    <Link to={paths.bot(id)} className="staff-person-name">
      <DisplayName name={data?.name ?? id} badges={data?.badges} entity="bot" focusable={false} />
    </Link>
  );
}

function GuildLink({id}: {id: string}) {
  const {data} = useGuild(id);
  return (
    <Link to={paths.guild(id)} className="staff-person-name">
      <DisplayName name={data?.name ?? id} badges={data?.badges} entity="guild" focusable={false} />
    </Link>
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
