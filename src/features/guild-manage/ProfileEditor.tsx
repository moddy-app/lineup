import {useEffect, useMemo, useRef, useState} from 'react';

import {useCatalogLabel} from '@/api/catalog';
import {hasCode, isApiError} from '@/api/client';
import {errorMessage, fieldErrors} from '@/api/errors';
import {FIELD_LIMITS} from '@/api/limits';
import {useUpdateGuild} from '@/api/mutations';
import {useCatalog} from '@/api/queries';
import type {GuildProfile} from '@/api/types';
import {registerBeforeLogin} from '@/auth/beforeLogin';
import {useSession} from '@/auth/session';
import {useAuthAction} from '@/auth/useAuthAction';
import {InviteHelp, RetryButton} from '@/components';
import {useT} from '@/i18n/useT';
import {getItem, removeItem, setItem} from '@/lib/storage';
import {Checkbox, Icon, Panel, Pill, Section, Select, Switch, TextField, useSnackbar} from '@/ui';
import {SanctionNotice} from '../guilds/SanctionNotice';

import {
  buildUpdate,
  hasChanges,
  type LocalIssue,
  parseTags,
  type ProfileFormValues,
  validateValues,
  valuesFromProfile,
} from './profileForm';

const INVITE_CODES = ['invite_invalid', 'invite_not_found', 'invite_expiring', 'invite_guild_mismatch'];
const draftKey = (guildId: string) => `guild-manage-draft:${guildId}`;

export function ProfileEditor({guild}: {guild: GuildProfile}) {
  const {t} = useT('guildManage');
  const {t: tErrors} = useT('errors');
  const {label} = useCatalogLabel();
  const catalog = useCatalog();
  const update = useUpdateGuild();
  const auth = useAuthAction();
  const {canWrite} = useSession();
  const snackbar = useSnackbar();

  const [baseline, setBaseline] = useState(() => valuesFromProfile(guild));
  const [values, setValues] = useState<ProfileFormValues>(() => {
    const draft = getItem<ProfileFormValues | null>(draftKey(guild.id), null, 'session');
    removeItem(draftKey(guild.id), 'session');
    return draft ?? valuesFromProfile(guild);
  });
  const [error, setError] = useState<unknown>(null);
  const [showLocal, setShowLocal] = useState(false);
  const inviteDetails = useRef<HTMLDetailsElement>(null);

  // Signing in leaves the page: keep the form.
  useEffect(() => registerBeforeLogin(() => void setItem(draftKey(guild.id), values, 'session')), [guild.id, values]);

  const set = (patch: Partial<ProfileFormValues>) => {
    setValues((current) => ({...current, ...patch}));
    if (error !== null) setError(null);
  };

  const body = useMemo(() => buildUpdate(baseline, values), [baseline, values]);
  const dirty = hasChanges(body);
  const limits = catalog.data?.limits;
  const localIssues = useMemo(
    () => (limits ? validateValues(values, limits) : ({} as Record<string, LocalIssue>)),
    [values, limits],
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
  const unmapped = validation
    ? Object.entries(apiFields)
        .filter(
          ([key]) =>
            !['description', 'theme', 'tags', 'languages', 'invite', 'listed'].includes(key) &&
            !key.startsWith('links'),
        )
        .map(([, message]) => message)
    : [];

  useEffect(() => {
    if (hasCode(error, 'invite_expiring') && inviteDetails.current) inviteDetails.current.open = true;
  }, [error]);

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

  const tagList = parseTags(values.tags);
  const linkSlots = limits?.max_links ?? 5;
  const languageMax = limits?.max_languages ?? 10;
  const themeOptions = [
    {value: '', label: t('theme.none')},
    ...(catalog.data?.themes ?? []).map((theme) => ({value: theme.id, label: label('themes', theme.id)})),
  ];

  const setLink = (index: number, patch: Partial<{label: string; url: string}>) =>
    set({links: values.links.map((link, at) => (at === index ? {...link, ...patch} : link))});

  const toggleLanguage = (id: string, on: boolean) =>
    set({languages: on ? [...values.languages, id] : values.languages.filter((language) => language !== id)});

  const discordText = guild.discord_description?.trim();

  return (
    <Section
      title={t('editor.title')}
      actions={dirty ? <span className="manage-dirty">{t('editor.unsaved')}</span> : undefined}
    >
      <form
        className="manage-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <fieldset className="manage-group">
          <legend>{t('description.title')}</legend>
          <TextField
            label={t('description.label')}
            value={values.description}
            onValueChange={(description) => set({description})}
            rows={6}
            maxLength={FIELD_LIMITS.guild.descriptionMax}
            supportingText={t('description.hint')}
            errorText={fieldError('description')}
          />
          <Panel className="manage-discord-text">
            <p>
              <strong>{t('description.discordTitle')}</strong>
            </p>
            <p>{discordText ? discordText : t('description.discordNone')}</p>
            {values.description !== '' && (
              <md-text-button onclick={() => set({description: ''})}>{t('description.useDiscord')}</md-text-button>
            )}
          </Panel>
        </fieldset>

        <fieldset className="manage-group">
          <legend>{t('links.title')}</legend>
          <p className="manage-help">{t('links.hint', {count: linkSlots})}</p>
          {values.links.map((link, index) => (
            <div className="manage-link" key={index}>
              <TextField
                label={t('links.label', {n: index + 1})}
                value={link.label}
                onValueChange={(next) => setLink(index, {label: next})}
                maxLength={FIELD_LIMITS.link.labelMax}
                errorText={fieldError(`links.${index}.label`)}
              />
              <TextField
                label={t('links.url', {n: index + 1})}
                type="url"
                inputMode="url"
                value={link.url}
                onValueChange={(next) => setLink(index, {url: next})}
                maxLength={FIELD_LIMITS.link.urlMax}
                placeholder="https://"
                errorText={fieldError(`links.${index}.url`)}
              />
              <md-icon-button
                aria-label={t('links.remove', {n: index + 1})}
                onclick={() => set({links: values.links.filter((_, at) => at !== index)})}
              >
                <Icon name="close" />
              </md-icon-button>
            </div>
          ))}
          {fieldError('links') && <p className="manage-field-error">{fieldError('links')}</p>}
          <div>
            <md-outlined-button
              disabled={values.links.length >= linkSlots}
              onclick={() => set({links: [...values.links, {label: '', url: ''}]})}
            >
              <md-icon slot="icon" className="filled" aria-hidden="true">
                add
              </md-icon>
              {t('links.add')}
            </md-outlined-button>
          </div>
        </fieldset>

        <fieldset className="manage-group">
          <legend>{t('topics.title')}</legend>
          <Select
            label={t('theme.label')}
            value={values.theme}
            options={themeOptions}
            onValueChange={(theme) => set({theme})}
            errorText={fieldError('theme')}
          />
          <TextField
            label={t('tags.label')}
            value={values.tags}
            onValueChange={(tags) => set({tags})}
            supportingText={t('tags.hint', {count: tagList.length, max: limits?.max_tags ?? 10})}
            errorText={fieldError('tags')}
            autocomplete="off"
          />
          <div role="group" aria-labelledby="manage-languages">
            <p id="manage-languages" className="manage-label">
              {t('languages.label', {count: values.languages.length, max: languageMax})}
            </p>
            <div className="manage-checks">
              {(catalog.data?.languages ?? []).map((language) => {
                const checked = values.languages.includes(language.id);
                return (
                  <Checkbox
                    key={language.id}
                    checked={checked}
                    disabled={!checked && values.languages.length >= languageMax}
                    onCheckedChange={(on) => toggleLanguage(language.id, on)}
                    label={label('languages', language.id)}
                  />
                );
              })}
            </div>
            {fieldError('languages') && <p className="manage-field-error">{fieldError('languages')}</p>}
          </div>
        </fieldset>

        <fieldset className="manage-group">
          <legend>{t('invite.title')}</legend>
          <p className="manage-help">
            {guild.invite ? (
              <>
                {t('invite.current')} <Pill>{guild.invite.code}</Pill>{' '}
                {guild.invite.valid ? t('invite.valid') : t('invite.lost')}
              </>
            ) : (
              t('invite.none')
            )}
          </p>
          <TextField
            label={t('invite.label')}
            value={values.invite}
            onValueChange={(invite) => set({invite})}
            placeholder={t('invite.placeholder')}
            supportingText={t('invite.hint')}
            errorText={inviteError}
            maxLength={FIELD_LIMITS.guild.inviteMax}
            autocomplete="off"
            inputMode="url"
          />
          <details className="manage-details" ref={inviteDetails}>
            <summary>{t('invite.how')}</summary>
            <InviteHelp headingLevel={4} />
          </details>
        </fieldset>

        <fieldset className="manage-group">
          <legend>{t('visibility.title')}</legend>
          <Switch checked={values.listed} onCheckedChange={(listed) => set({listed})} label={t('visibility.label')} />
          <p className="manage-help">{values.listed ? t('visibility.on') : t('visibility.off')}</p>
        </fieldset>

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
              {hasCode(error, 'discord_unavailable') && (
                <RetryButton error={error} onRetry={() => void save()} busy={update.isPending} />
              )}
            </div>
          ))}

        <div className="card-actions">
          <md-filled-button type="submit" disabled={!dirty || update.isPending || !canWrite}>
            {update.isPending ? t('editor.saving') : t('editor.save')}
          </md-filled-button>
          <md-text-button type="button" disabled={!dirty || update.isPending} onclick={reset}>
            {t('editor.reset')}
          </md-text-button>
        </div>
      </form>
    </Section>
  );
}
