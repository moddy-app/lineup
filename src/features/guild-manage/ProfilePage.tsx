import {useState} from 'react';

import {useCatalogLabel} from '@/api/catalog';
import {FIELD_LIMITS} from '@/api/limits';
import {useCatalog} from '@/api/queries';
import {Markdown} from '@/components';
import {flagUrl} from '@/components/languageFlags';
import {useT} from '@/i18n/useT';
import {Checkbox, Icon, SettingsPanel, Select, TextField} from '@/ui';

import {SaveBar} from './SaveBar';
import {parseTags} from './profileForm';
import {useGuildForm} from './useGuildForm';
import {useManagedGuild} from './useManagedGuild';

/** /guilds/:guildId/manage : the public profile (description, theme, tags, languages, links). */
export function Component() {
  const guild = useManagedGuild();
  const {t} = useT('guildManage');
  const {label} = useCatalogLabel();
  const catalog = useCatalog();
  const form = useGuildForm(guild, 'profile');
  const {values, set, limits, fieldError} = form;
  const [preview, setPreview] = useState(false);

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
    <form
      className="manage-form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void form.save();
      }}
    >
      <SettingsPanel className="manage-panel" title={t('profile.title')} description={t('profile.description')}>
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
          <div className="manage-tools">
            <md-text-button type="button" onclick={() => setPreview((on) => !on)}>
              <md-icon slot="icon" className="filled" aria-hidden="true">
                {preview ? 'visibility_off' : 'visibility'}
              </md-icon>
              {preview ? t('description.hidePreview') : t('description.preview')}
            </md-text-button>
            {values.description !== '' && (
              <md-text-button type="button" onclick={() => set({description: ''})}>
                {t('description.useDiscord')}
              </md-text-button>
            )}
          </div>
          {preview && (
            <div className="manage-preview" aria-live="polite">
              {values.description.trim() !== '' ? (
                <Markdown>{values.description}</Markdown>
              ) : (
                <p className="manage-help">{discordText ? discordText : t('description.discordNone')}</p>
              )}
            </div>
          )}
          {!preview && values.description === '' && (
            <p className="manage-help manage-discord-text">
              <strong>{t('description.discordTitle')}</strong>{' '}
              {discordText ? discordText : t('description.discordNone')}
            </p>
          )}
        </fieldset>

        <fieldset className="manage-group">
          <legend>{t('topics.title')}</legend>
          <div className="manage-pair">
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
          </div>
        </fieldset>

        <fieldset className="manage-group">
          <legend>{t('languages.label', {count: values.languages.length, max: languageMax})}</legend>
          <div className="manage-checks">
            {(catalog.data?.languages ?? []).map((language) => {
              const checked = values.languages.includes(language.id);
              const name = label('languages', language.id);
              const flag = flagUrl(language.id);
              return (
                <Checkbox
                  key={language.id}
                  className="manage-check"
                  checked={checked}
                  disabled={!checked && values.languages.length >= languageMax}
                  onCheckedChange={(on) => toggleLanguage(language.id, on)}
                  ariaLabel={name}
                  label={
                    <span className="manage-lang">
                      {flag && <img src={flag} alt="" width={21} height={16} loading="lazy" decoding="async" />}
                      {name}
                    </span>
                  }
                />
              );
            })}
          </div>
          {fieldError('languages') && <p className="manage-field-error">{fieldError('languages')}</p>}
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
                type="button"
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
              type="button"
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
      </SettingsPanel>

      <SaveBar {...form.bar} />
    </form>
  );
}
