import {useEffect, useMemo, useState} from 'react';

import {isApiError} from '@/api/client';
import {errorMessage, fieldErrors} from '@/api/errors';
import {useUpdateGuild} from '@/api/mutations';
import {useCatalog} from '@/api/queries';
import type {GuildProfile} from '@/api/types';
import {registerBeforeLogin} from '@/auth/beforeLogin';
import {useAuthAction} from '@/auth/useAuthAction';
import {useT} from '@/i18n/useT';
import {getItem, removeItem, setItem} from '@/lib/storage';
import {useSnackbar} from '@/ui';

import {
  buildUpdate,
  type FormScope,
  hasChanges,
  type LocalIssue,
  type ProfileFormValues,
  SCOPE_FIELDS,
  validateValues,
  valuesFromProfile,
} from './profileForm';

const INVITE_CODES = ['invite_invalid', 'invite_not_found', 'invite_expiring', 'invite_guild_mismatch'];
const draftKey = (guildId: string, scope: FormScope) => `guild-manage-draft:${guildId}:${scope}`;

/**
 * The form of one management page (`scope`): its values, its draft kept
 * before signing in, local and server errors, and the save. Only the fields of
 * the page are compared and sent (`buildUpdate`).
 */
export function useGuildForm(guild: GuildProfile, scope: FormScope) {
  const {t} = useT('guildManage');
  const {t: tErrors} = useT('errors');
  const catalog = useCatalog();
  const update = useUpdateGuild();
  const auth = useAuthAction();
  const snackbar = useSnackbar();

  const [baseline, setBaseline] = useState(() => valuesFromProfile(guild));
  const [values, setValues] = useState<ProfileFormValues>(() => {
    const draft = getItem<ProfileFormValues | null>(draftKey(guild.id, scope), null, 'session');
    removeItem(draftKey(guild.id, scope), 'session');
    return draft ? {...valuesFromProfile(guild), ...draft} : valuesFromProfile(guild);
  });
  const [error, setError] = useState<unknown>(null);
  const [showLocal, setShowLocal] = useState(false);

  // Signing in leaves the page: keep the form.
  useEffect(
    () => registerBeforeLogin(() => void setItem(draftKey(guild.id, scope), values, 'session')),
    [guild.id, scope, values],
  );

  const set = (patch: Partial<ProfileFormValues>) => {
    setValues((current) => ({...current, ...patch}));
    if (error !== null) setError(null);
  };

  const body = useMemo(() => buildUpdate(baseline, values, scope), [baseline, values, scope]);
  const dirty = hasChanges(body);
  const limits = catalog.data?.limits;
  const localIssues = useMemo(
    () => (limits ? validateValues(values, limits, scope) : ({} as Record<string, LocalIssue>)),
    [values, limits, scope],
  );
  const issueText = (key: string): string | undefined => {
    const issue = localIssues[key];
    return issue ? String((t as (key: string, options?: object) => string)(issue.key, issue.params)) : undefined;
  };
  const apiFields = useMemo(() => fieldErrors(error, tErrors), [error, tErrors]);
  const fieldError = (key: string): string | undefined => (showLocal ? issueText(key) : undefined) ?? apiFields[key];

  const inviteCode = isApiError(error) && error.code !== null && INVITE_CODES.includes(error.code);
  const inviteError = (inviteCode ? errorMessage(error, tErrors) : undefined) ?? fieldError('invite');
  const validation = isApiError(error) && error.validation !== null;
  // Issues the form has no field for (an unknown key, a model-level rule) are listed in the alert.
  const known = SCOPE_FIELDS[scope] as readonly string[];
  const unmapped = validation
    ? Object.entries(apiFields)
        .filter(([key]) => !known.includes(key) && !(known.includes('links') && key.startsWith('links')))
        .map(([, message]) => message)
    : [];

  const save = async () => {
    setError(null);
    if (Object.keys(localIssues).length > 0) {
      setShowLocal(true);
      return;
    }
    if (!dirty) return;
    try {
      const profile = await auth.run(() => update.mutateAsync({guildId: guild.id, body}));
      if (!profile) return;
      const next = valuesFromProfile(profile);
      setBaseline(next);
      setValues(next);
      setShowLocal(false);
      snackbar.show({message: t('saved')});
    } catch (caught) {
      setError(caught);
    }
  };

  const reset = () => {
    setValues(baseline);
    setError(null);
    setShowLocal(false);
  };

  return {
    values,
    set,
    dirty,
    limits,
    fieldError,
    inviteCode,
    inviteError,
    save,
    bar: {
      dirty,
      error,
      validation,
      unmapped,
      inviteCode,
      pending: update.isPending,
      onReset: reset,
      onRetry: () => void save(),
    },
  };
}
