/**
 * My profile editor (LINEUP.md §6.3). One form: headline, bio, open to work,
 * links, languages, time zone. Only the changed fields are sent; the answer
 * becomes the cache. The draft survives the sign-in redirect of an expired session.
 */

import {useEffect, useRef, useState} from 'react';

import {useCatalogLabel} from '@/api/catalog';
import {errorMessage, fieldErrors} from '@/api/errors';
import {useUpdateMyProfile} from '@/api/mutations';
import {useCatalog, useMyProfile} from '@/api/queries';
import type {UserProfile} from '@/api/types';
import {paths} from '@/app/paths';
import {usePageTitle} from '@/app/usePageTitle';
import {registerBeforeLogin} from '@/auth/beforeLogin';
import {useSession} from '@/auth/session';
import {useAuthAction} from '@/auth/useAuthAction';
import {ErrorState, Markdown, TimezoneLabel} from '@/components';
import {flagUrl} from '@/components/languageFlags';
import {useT} from '@/i18n/useT';
import {getItem, removeItem, setItem} from '@/lib/storage';
import {
  Checkbox,
  LinkButton,
  PageLoading,
  Pill,
  SettingsLayout,
  SettingsPanel,
  Shape,
  Switch,
  TextField,
  useSnackbar,
} from '@/ui';

import './me-profile.css';
import {
  BIO_MAX,
  browserTimezone,
  type FieldProblem,
  formFromProfile,
  HEADLINE_MAX,
  hasChanges,
  isValidTimezone,
  LANGUAGES_MAX,
  LINK_LABEL_MAX,
  LINKS_MAX,
  profileChanges,
  type ProfileFormState,
  TIMEZONE_MAX,
  validateProfile,
} from './profileForm';

const DRAFT_KEY = 'lineup-me-profile-draft';

export function Component() {
  const {t} = useT('meProfile');
  usePageTitle(t('title'));
  const query = useMyProfile();

  if (query.isPending) return <PageLoading />;
  if (query.isError) {
    return (
      <SettingsLayout title={t('title')}>
        <ErrorState error={query.error} onRetry={() => void query.refetch()} retrying={query.isFetching} />
      </SettingsLayout>
    );
  }
  return <Editor profile={query.data} />;
}

function Editor({profile}: {profile: UserProfile}) {
  const {t} = useT('meProfile');
  const {t: tErrors} = useT('errors');
  const {label} = useCatalogLabel();
  const catalog = useCatalog().data;
  const {canWrite} = useSession();
  const auth = useAuthAction();
  const snackbar = useSnackbar();
  const update = useUpdateMyProfile();

  const initial = formFromProfile(profile);
  const [form, setForm] = useState<ProfileFormState>(() => {
    const draft = getItem<ProfileFormState | null>(DRAFT_KEY, null, 'session');
    removeItem(DRAFT_KEY, 'session');
    return draft ?? initial;
  });
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<unknown>(null);
  const [preview, setPreview] = useState(false);

  // The sign-in redirect keeps the form (a session that expired while writing).
  const latest = useRef(form);
  useEffect(() => {
    latest.current = form;
  });
  useEffect(() => registerBeforeLogin(() => setItem(DRAFT_KEY, latest.current, 'session')), []);

  const set = <K extends keyof ProfileFormState>(key: K, value: ProfileFormState[K]) => {
    setForm((current) => ({...current, [key]: value}));
    setServerErrors((current) => {
      if (!(key in current)) return current;
      const {[key]: _removed, ...rest} = current;
      return rest;
    });
  };

  const problems = validateProfile(form);
  const problemText = (field: string): string | undefined => {
    const server = serverErrors[field];
    if (server) return server;
    const problem: FieldProblem | undefined = submitted ? problems[field] : undefined;
    return problem ? t(`problems.${problem.key}`, {count: problem.count}) : undefined;
  };

  const dirty = hasChanges(initial, form);
  const languageLimit = catalog?.limits.max_languages ?? LANGUAGES_MAX;
  const linkLimit = catalog?.limits.max_links ?? LINKS_MAX;

  async function save() {
    setSubmitted(true);
    setFailure(null);
    if (Object.keys(problems).length > 0) return;
    const body = profileChanges(initial, form);
    if (Object.keys(body).length === 0) return;
    try {
      const saved = await auth.run(() => update.mutateAsync(body));
      if (!saved) return;
      setForm(formFromProfile(saved));
      setServerErrors({});
      setSubmitted(false);
      snackbar.show({message: t('saved')});
    } catch (error) {
      const fields = fieldErrors(error, tErrors);
      if (Object.keys(fields).length > 0) setServerErrors(fields);
      setFailure(error);
    }
  }

  function reset() {
    setForm(initial);
    setServerErrors({});
    setFailure(null);
    setSubmitted(false);
  }

  const setLink = (index: number, patch: Partial<{label: string; url: string}>) => {
    set(
      'links',
      form.links.map((link, i) => (i === index ? {...link, ...patch} : link)),
    );
    setServerErrors({});
  };

  const zone = browserTimezone();
  const zoneValid = isValidTimezone(form.timezone.trim());
  const formError = failure && Object.keys(serverErrors).length === 0 ? errorMessage(failure, tErrors) : null;
  const languageOptions = catalog?.languages ?? [];

  return (
    <SettingsLayout
      title={t('title')}
      description={t('description')}
      actions={
        <LinkButton to={paths.user(profile.id)} variant="outlined" icon="visibility">
          {t('viewPublic')}
        </LinkButton>
      }
    >
      <form
        className="me-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <SettingsPanel title={t('panels.presentation.title')} description={t('panels.presentation.description')}>
          <TextField
            label={t('fields.headline')}
            value={form.headline}
            onValueChange={(value) => set('headline', value)}
            maxLength={HEADLINE_MAX}
            supportingText={t('fields.headlineHelp')}
            errorText={problemText('headline')}
          />
          <TextField
            label={t('fields.bio')}
            value={form.bio}
            onValueChange={(value) => set('bio', value)}
            rows={6}
            maxLength={BIO_MAX}
            supportingText={t('fields.bioHelp')}
            errorText={problemText('bio')}
          />
          <div className="me-preview">
            <md-text-button type="button" aria-expanded={preview} onclick={() => setPreview((on) => !on)}>
              <md-icon slot="icon" className="filled" aria-hidden="true">
                {preview ? 'visibility_off' : 'visibility'}
              </md-icon>
              {preview ? t('preview.hide') : t('preview.show')}
            </md-text-button>
            {preview &&
              (form.bio.trim() ? (
                <div className="me-preview-body">
                  <Markdown>{form.bio}</Markdown>
                </div>
              ) : (
                <p className="me-help">{t('preview.empty')}</p>
              ))}
          </div>
        </SettingsPanel>

        <SettingsPanel title={t('panels.availability.title')} description={t('panels.availability.description')}>
          <Switch
            checked={form.open_to_work}
            onCheckedChange={(on) => set('open_to_work', on)}
            label={t('fields.openToWork')}
            description={t('fields.openToWorkHelp')}
          />
        </SettingsPanel>

        <SettingsPanel title={t('panels.locale.title')} description={t('panels.locale.description')}>
          <p className="me-help numeric">{t('languages.help', {count: form.languages.length, max: languageLimit})}</p>
          <div className="me-languages" role="group" aria-label={t('languages.title')}>
            {languageOptions.map((language) => {
              const checked = form.languages.includes(language.id);
              const name = label('languages', language.id, language.label);
              const url = flagUrl(language.id);
              return (
                <Checkbox
                  key={language.id}
                  checked={checked}
                  disabled={!checked && form.languages.length >= languageLimit}
                  onCheckedChange={(on) =>
                    set(
                      'languages',
                      on ? [...form.languages, language.id] : form.languages.filter((id) => id !== language.id),
                    )
                  }
                  ariaLabel={name}
                  label={
                    <span className="me-language">
                      {url && <img src={url} alt="" width={21} height={16} loading="lazy" decoding="async" />}
                      {name}
                    </span>
                  }
                />
              );
            })}
          </div>
          {problemText('languages') && (
            <p className="me-error" role="alert">
              {problemText('languages')}
            </p>
          )}
          <TextField
            label={t('timezone.label')}
            value={form.timezone}
            onValueChange={(value) => set('timezone', value)}
            maxLength={TIMEZONE_MAX}
            placeholder="Europe/Paris"
            supportingText={t('timezone.help')}
            errorText={problemText('timezone')}
          />
          {zoneValid && <TimezoneLabel timezone={form.timezone.trim()} inline />}
          {zone && zone !== form.timezone.trim() && (
            <div className="me-zone-suggestion">
              <Shape shape="pentagon" tone="tertiary" icon="schedule" small />
              <p>{t('timezone.suggestion')}</p>
              <Pill>{zone}</Pill>
              <md-text-button type="button" onclick={() => set('timezone', zone)}>
                {t('timezone.use')}
              </md-text-button>
            </div>
          )}
        </SettingsPanel>

        <SettingsPanel
          title={t('links.title')}
          description={t('links.help', {count: linkLimit})}
          actions={
            <>
              <span className="me-count numeric">{t('links.count', {count: form.links.length, max: linkLimit})}</span>
              <md-outlined-button
                type="button"
                disabled={form.links.length >= linkLimit}
                onclick={() => set('links', [...form.links, {label: '', url: ''}])}
              >
                <md-icon slot="icon" className="filled" aria-hidden="true">
                  add_link
                </md-icon>
                {t('links.add')}
              </md-outlined-button>
            </>
          }
        >
          {form.links.length > 0 && (
            <ul className="me-links">
              {form.links.map((link, index) => (
                <li key={index} className="me-link">
                  <TextField
                    label={t('links.label')}
                    value={link.label}
                    onValueChange={(value) => setLink(index, {label: value})}
                    maxLength={LINK_LABEL_MAX}
                    errorText={problemText(`links.${index}.label`)}
                  />
                  <TextField
                    label={t('links.url')}
                    type="url"
                    inputMode="url"
                    value={link.url}
                    onValueChange={(value) => setLink(index, {url: value})}
                    placeholder="https://"
                    errorText={problemText(`links.${index}.url`)}
                  />
                  <md-icon-button
                    type="button"
                    aria-label={t('links.remove', {label: link.label || index + 1})}
                    onclick={() =>
                      set(
                        'links',
                        form.links.filter((_, i) => i !== index),
                      )
                    }
                  >
                    <md-icon>delete</md-icon>
                  </md-icon-button>
                </li>
              ))}
            </ul>
          )}
          {problemText('links') && (
            <p className="me-error" role="alert">
              {problemText('links')}
            </p>
          )}
        </SettingsPanel>

        {(dirty || formError) && (
          <div className="me-actionbar" role="group" aria-label={t('unsaved')}>
            <p className={formError ? 'me-error' : 'me-help'} role={formError ? 'alert' : undefined}>
              {formError ?? t('unsaved')}
            </p>
            <div className="me-actionbar-buttons">
              <md-outlined-button type="button" disabled={!dirty || update.isPending} onclick={reset}>
                {t('reset')}
              </md-outlined-button>
              <md-filled-button type="submit" disabled={!canWrite || update.isPending || !dirty}>
                {update.isPending ? t('saving') : t('save')}
              </md-filled-button>
            </div>
          </div>
        )}
      </form>
    </SettingsLayout>
  );
}
