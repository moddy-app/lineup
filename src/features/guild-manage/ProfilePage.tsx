import {useState} from 'react';

import {useCatalogLabel} from '@/api/catalog';
import {FIELD_LIMITS} from '@/api/limits';
import {useCatalog} from '@/api/queries';
import {Markdown} from '@/components';
import {flagUrl} from '@/components/languageFlags';
import {useT} from '@/i18n/useT';
import {Checkbox, Icon, SettingsPanel, Select, TextField} from '@/ui';

import {type ManageNamespace, SaveBar} from './SaveBar';
import {parseTags} from './profileForm';
import {useGuildForm} from './useGuildForm';
import {useManagedGuild} from './useManagedGuild';

/** /guilds/:guildId/manage : the public profile (description, theme, tags, languages, links). */
export function Component() {
  const guild = useManagedGuild();
  return (
    <ProfileEditor form={useGuildForm(guild, 'profile')} discordText={guild.discord_description} ns="guildManage" />
  );
}

interface ProfileEditorProps {
  form: ReturnType<typeof useGuildForm>;
  /** Discord's own description (a server's, or a bot's App Directory text): what shows when the field is empty. */
  discordText: string | null;
  /** Whose words: a server's (`guildManage`) or a bot's (`botManage`, the same keys). */
  ns: ManageNamespace;
}

/** The profile form of a server or a bot: description, theme and tags, languages, links, and the save bar. */
export function ProfileEditor({form, discordText: rawDiscordText, ns}: ProfileEditorProps) {
  const {t} = useT(ns as 'guildManage');
  const {label} = useCatalogLabel();
  const catalog = useCatalog();
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

  const discordText = rawDiscordText?.trim();

  return (
    <form
      className="manage-form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void form.save();
      }}
    >
      <SettingsPanel className="manage-panel" title={t('description.title')} description={t('profile.description')}>
        <div className="manage-group">
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
        </div>
      </SettingsPanel>

      <SettingsPanel className="manage-panel" title={t('topics.title')} description={t('topics.description')}>
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
      </SettingsPanel>

      <SettingsPanel
        className="manage-panel"
        title={t('languages.title')}
        description={t('languages.description', {count: values.languages.length, max: languageMax})}
      >
        <div className="manage-group" role="group" aria-label={t('languages.title')}>
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
        </div>
      </SettingsPanel>

      <SettingsPanel
        className="manage-panel"
        title={t('links.title')}
        description={t('links.hint', {count: linkSlots})}
        actions={
          <md-outlined-button
            type="button"
            disabled={values.links.length >= linkSlots}
            onclick={() => set({links: [...values.links, {label: '', url: ''}]})}
          >
            <md-icon slot="icon" className="filled" aria-hidden="true">
              add_link
            </md-icon>
            {t('links.add')}
          </md-outlined-button>
        }
      >
        <div className="manage-group">
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
                <Icon name="delete" />
              </md-icon-button>
            </div>
          ))}
          {fieldError('links') && <p className="manage-field-error">{fieldError('links')}</p>}
        </div>
      </SettingsPanel>

      <SaveBar {...form.bar} ns={ns} />
    </form>
  );
}
