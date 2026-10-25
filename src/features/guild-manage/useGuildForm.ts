import {useEffect, useMemo, useState} from 'react';

import {isApiError} from '@/api/client';
import {errorMessage, fieldErrors} from '@/api/errors';
import {useUpdateBot, useUpdateGuild} from '@/api/mutations';
import {useCatalog} from '@/api/queries';
import type {BotProfile, GuildProfile} from '@/api/types';
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
  valuesFromBot,
  valuesFromProfile,
} from './profileForm';

const INVITE_CODES = ['invite_invalid', 'invite_not_found', 'invite_expiring', 'invite_guild_mismatch'];

/** What a management form edits: a server's profile or a bot's (the same fields, a bot has no invitation). */
export type ManagedProfile = {kind: 'guild'; profile: GuildProfile} | {kind: 'bot'; profile: BotProfile};

const draftKey = (target: ManagedProfile, scope: FormScope) =>
  `${target.kind === 'bot' ? 'bot' : 'guild'}-manage-draft:${target.profile.id}:${scope}`;

const valuesOf = (target: ManagedProfile) =>
  target.kind === 'bot' ? valuesFromBot(target.profile) : valuesFromProfile(target.profile);

/** The form of one page of a server's management (see `useProfileForm`). */
export function useGuildForm(guild: GuildProfile, scope: FormScope) {
  return useProfileForm({kind: 'guild', profile: guild}, scope);
}

/** The form of one page of a bot's management (see `useProfileForm`). */
export function useBotForm(bot: BotProfile, scope: FormScope) {
  return useProfileForm({kind: 'bot', profile: bot}, scope);
}

/**
 * The form of one management page (`scope`): its values, its draft kept
 * before signing in, local and server errors, and the save. Only the fields of
 * the page are compared and sent (`buildUpdate`).
 */
function useProfileForm(target: ManagedProfile, scope: FormScope) {
  const {t} = useT('guildManage');
  const {t: tBot} = useT('botManage');
  const {t: tErrors} = useT('errors');
  const catalog = useCatalog();
  const updateGuild = useUpdateGuild();
  const updateBot = useUpdateBot();
  const auth = useAuthAction();
  const snackbar = useSnackbar();
  const id = target.profile.id;
  const key = draftKey(target, scope);

  const [baseline, setBaseline] = useState(() => valuesOf(target));
  const [values, setValues] = useState<ProfileFormValues>(() => {
    const draft = getItem<ProfileFormValues | null>(key, null, 'session');
    removeItem(key, 'session');
    return draft ? {...valuesOf(target), ...draft} : valuesOf(target);
  });
  const [error, setError] = useState<unknown>(null);
  const [showLocal, setShowLocal] = useState(false);

  // Signing in leaves the page: keep the form.
  useEffect(() => registerBeforeLogin(() => void setItem(key, values, 'session')), [key, values]);

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
      const next =
        target.kind === 'bot'
          ? await auth.run(async () => {
              const {invite: _invite, ...botBody} = body;
              return valuesFromBot(await updateBot.mutateAsync({botId: id, body: botBody}));
            })
          : await auth.run(async () => valuesFromProfile(await updateGuild.mutateAsync({guildId: id, body})));
      if (!next) return;
      setBaseline(next);
      setValues(next);
      setShowLocal(false);
      snackbar.show({message: target.kind === 'bot' ? tBot('saved') : t('saved')});
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
      pending: updateGuild.isPending || updateBot.isPending,
      onReset: reset,
      onRetry: () => void save(),
    },
  };
}
