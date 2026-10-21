/** Create or edit an experience in a dialog (LINEUP.md §6.6, §7). */

import {useEffect, useRef, useState} from 'react';

import {useCatalogLabel} from '@/api/catalog';
import {hasCode, isApiError} from '@/api/client';
import {errorMessage, fieldErrors} from '@/api/errors';
import {useCreateExperience, useUpdateExperience} from '@/api/mutations';
import {useCatalog} from '@/api/queries';
import type {PrivateExperience} from '@/api/types';
import {registerBeforeLogin} from '@/auth/beforeLogin';
import {useSession} from '@/auth/session';
import {useAuthAction} from '@/auth/useAuthAction';
import {InviteHelp, isRetryable, RetryButton} from '@/components';
import {useT} from '@/i18n/useT';
import {setItem} from '@/lib/storage';
import {Checkbox, Dialog, Icon, Select, TextField, useSnackbar} from '@/ui';

import {
  createBody,
  DESCRIPTION_MAX,
  emptyForm,
  type ExperienceFormState,
  type ExperienceProblem,
  formFromExperience,
  NAME_MAX,
  POSITION_OTHER_MAX,
  todayIso,
  updateBody,
  validateExperience,
  verificationEffect,
} from './experienceForm';

export const EXPERIENCE_DRAFT_KEY = 'lineup-experience-draft';

const INVITE_ERRORS = ['invite_not_found', 'invite_invalid', 'invite_expiring', 'invite_guild_mismatch'];

interface ExperienceDialogProps {
  /** The experience being edited; null to create one. */
  experience: PrivateExperience | null;
  /** A form saved before a sign-in redirect. */
  draft?: ExperienceFormState | null;
  /** How many experiences exist, and the most allowed. */
  count: number;
  max: number;
  onClose: () => void;
}

export function ExperienceDialog({experience, draft, count, max, onClose}: ExperienceDialogProps) {
  const {t} = useT('experiences');
  const {t: tErrors} = useT('errors');
  const {t: tCommon} = useT('common');
  const {label} = useCatalogLabel();
  const catalog = useCatalog().data;
  const {canWrite} = useSession();
  const auth = useAuthAction();
  const snackbar = useSnackbar();
  const create = useCreateExperience();
  const update = useUpdateExperience();
  const editing = experience !== null;

  const [form, setForm] = useState<ExperienceFormState>(
    () => draft ?? (experience ? formFromExperience(experience) : emptyForm()),
  );
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<unknown>(null);
  const pending = create.isPending || update.isPending;

  const latest = useRef(form);
  useEffect(() => {
    latest.current = form;
  });
  useEffect(
    () =>
      registerBeforeLogin(() =>
        setItem(EXPERIENCE_DRAFT_KEY, {id: experience?.id ?? null, form: latest.current}, 'session'),
      ),
    [experience?.id],
  );

  const set = <K extends keyof ExperienceFormState>(key: K, value: ExperienceFormState[K]) => {
    setForm((current) => ({...current, [key]: value}));
    setServerErrors({});
    setFailure(null);
  };

  const problems = validateExperience(form, {editing, today: todayIso()});
  const text = (field: keyof ExperienceFormState): string | undefined => {
    const server = serverErrors[field];
    if (server) return server;
    const problem: ExperienceProblem | undefined = submitted ? problems[field] : undefined;
    return problem ? t(`problems.${problem.key}`, {count: problem.count}) : undefined;
  };

  const body = experience ? updateBody(experience, form) : null;
  const effect = experience && body ? verificationEffect(experience, body) : 'none';
  const status = experience?.verification.status;

  async function submit() {
    setSubmitted(true);
    setFailure(null);
    if (Object.keys(problems).length > 0) return;
    try {
      let saved: PrivateExperience | undefined;
      if (experience && body) {
        if (Object.keys(body).length === 0) {
          onClose();
          return;
        }
        saved = await auth.run(() => update.mutateAsync({experienceId: experience.id, body}));
      } else {
        saved = await auth.run(() => create.mutateAsync(createBody(form)));
      }
      if (!saved) return;
      snackbar.show({message: editing ? t('dialog.updated') : t('dialog.created')});
      onClose();
    } catch (error) {
      const fields = fieldErrors(error, tErrors);
      if (Object.keys(fields).length > 0) setServerErrors(fields);
      else if (hasCode(error, ...INVITE_ERRORS)) setServerErrors({invite: errorMessage(error, tErrors)});
      setFailure(error);
    }
  }

  const failureText = (() => {
    if (!failure || Object.keys(serverErrors).length > 0) return null;
    if (hasCode(failure, 'lineup_experience_limit')) return t('dialog.limit', {count: count, max});
    return errorMessage(failure, tErrors);
  })();

  const positions = (catalog?.positions ?? []).map((position) => ({
    value: position.id,
    label: label('positions', position.id, position.label),
  }));
  const kindOptions = [
    {value: 'guild', label: t('fields.kind.guild')},
    {value: 'service', label: t('fields.kind.service')},
  ];

  const saveLabel = pending
    ? t('dialog.saving')
    : effect === 'resets'
      ? t('dialog.saveAndReset')
      : editing
        ? tCommon('actions.save')
        : t('dialog.create');

  return (
    <Dialog
      open
      onClose={onClose}
      className="experience-dialog"
      headline={editing ? t('dialog.editTitle') : t('dialog.createTitle')}
      actions={
        <>
          <md-text-button type="button" disabled={pending} onclick={onClose}>
            {tCommon('actions.cancel')}
          </md-text-button>
          <md-filled-button
            type="button"
            disabled={!canWrite || pending || (editing && body !== null && Object.keys(body).length === 0)}
            onclick={() => void submit()}
          >
            {saveLabel}
          </md-filled-button>
        </>
      }
    >
      <form
        className="experience-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {editing && status && status !== 'unverified' && effect !== 'none' && (
          <p className={effect === 'keeps' ? 'exp-callout' : 'exp-callout is-warning'} role="status">
            <Icon name={effect === 'keeps' ? 'check_circle' : 'warning'} filled />
            <span>{t(effect === 'keeps' ? 'warning.keeps' : `warning.resets.${status}`)}</span>
          </p>
        )}
        {editing && status && status !== 'unverified' && effect === 'none' && (
          <p className="exp-callout" role="note">
            <Icon name="info" filled />
            <span>{t(`warning.before.${status}`)}</span>
          </p>
        )}

        <Select
          label={t('fields.kind.label')}
          value={form.kind}
          onValueChange={(value) => set('kind', value === 'service' ? 'service' : 'guild')}
          options={kindOptions}
          disabled={editing}
          supportingText={editing ? t('fields.kind.locked') : undefined}
        />

        {form.kind === 'guild' ? (
          <>
            {editing && experience && (
              <p className="exp-current-server">
                {t('fields.currentServer')} <strong>{experience.name}</strong>
              </p>
            )}
            <TextField
              label={editing ? t('fields.newInvite') : t('fields.invite')}
              value={form.invite}
              onValueChange={(value) => set('invite', value)}
              placeholder="https://discord.gg/…"
              supportingText={editing ? t('fields.newInviteHelp') : t('fields.inviteHelp')}
              errorText={text('invite')}
              autocomplete="off"
            />
            <details className="exp-invite-help">
              <summary>{t('fields.inviteHow')}</summary>
              <InviteHelp headingLevel={4} />
            </details>
          </>
        ) : (
          <TextField
            label={t('fields.name')}
            value={form.name}
            onValueChange={(value) => set('name', value)}
            maxLength={NAME_MAX}
            supportingText={t('fields.nameHelp')}
            errorText={text('name')}
          />
        )}

        <Select
          label={t('fields.position')}
          value={form.position}
          onValueChange={(value) => set('position', value)}
          options={[{value: '', label: t('fields.positionPlaceholder')}, ...positions]}
          errorText={text('position')}
        />
        {form.position === 'other' && (
          <TextField
            label={t('fields.positionOther')}
            value={form.position_other}
            onValueChange={(value) => set('position_other', value)}
            maxLength={POSITION_OTHER_MAX}
            errorText={text('position_other')}
          />
        )}

        <TextField
          label={t('fields.description')}
          value={form.description}
          onValueChange={(value) => set('description', value)}
          rows={4}
          maxLength={DESCRIPTION_MAX}
          supportingText={t('fields.descriptionHelp')}
          errorText={text('description')}
        />

        <div className="exp-dates">
          <TextField
            label={t('fields.startDate')}
            type="date"
            value={form.start_date}
            onValueChange={(value) => set('start_date', value)}
            errorText={text('start_date')}
          />
          {!form.current && (
            <TextField
              label={t('fields.endDate')}
              type="date"
              value={form.end_date}
              onValueChange={(value) => set('end_date', value)}
              errorText={text('end_date')}
            />
          )}
        </div>
        <Checkbox
          checked={form.current}
          onCheckedChange={(on) => {
            set('current', on);
            if (on) set('end_date', '');
          }}
          label={t('fields.current')}
        />

        {!editing && count >= max && (
          <p className="exp-error" role="alert">
            {t('dialog.limit', {count, max})}
          </p>
        )}
        {failureText && (
          <div className="exp-error" role="alert">
            <p>{failureText}</p>
            {isApiError(failure) && isRetryable(failure) && (
              <RetryButton onRetry={() => void submit()} error={failure} busy={pending} />
            )}
          </div>
        )}
      </form>
    </Dialog>
  );
}
