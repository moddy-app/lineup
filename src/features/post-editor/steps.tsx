/** The seven steps of the form (the eighth, the review, is in Review.tsx). */

import type {UseQueryResult} from '@tanstack/react-query';
import {useState} from 'react';

import {useCatalogLabel} from '@/api/catalog';
import {FIELD_LIMITS} from '@/api/limits';
import type {Catalog, ExperienceList, MyBotsResponse, MyGuild} from '@/api/types';
import {paths} from '@/app/paths';
import {BotAvatar, EmptyState, ErrorState, GuildIcon} from '@/components';
import {useLanguage} from '@/i18n/useLanguage';
import {useT} from '@/i18n/useT';
import {formatDate} from '@/lib/format';
import {Checkbox, Chip, Icon, LinkButton, Select, type SelectOption, Switch, TextField} from '@/ui';

import {CheckGroup, type ErrorOf, FieldBox, FieldError, type SetForm} from './fields';
import {
  browserTimezone,
  emptyRequirement,
  expiryBounds,
  type FormState,
  newRequirementKey,
  normalizeTag,
  type RequirementDraft,
} from './form';

export interface StepProps {
  form: FormState;
  set: SetForm;
  err: ErrorOf;
  catalog: Catalog;
  editing: boolean;
}

// ---------------------------------------------------------------------------
// 1. Type
// ---------------------------------------------------------------------------

interface TypeStepProps extends StepProps {
  guilds: UseQueryResult<MyGuild[]>;
  bots: UseQueryResult<MyBotsResponse>;
}

const KIND_ICON = {guild: 'groups', bot: 'smart_toy', user: 'badge'} as const;

/** "Who publishes": me, one of my servers, one of my bots. */
export function TypeStep({form, set, err, editing, guilds, bots}: TypeStepProps) {
  const {t} = useT('editor');
  const kinds = ['guild', 'bot', 'user'] as const;
  const chosenName =
    form.kind === 'bot'
      ? bots.data?.items.find((bot) => bot.id === form.botId)?.name
      : guilds.data?.find((guild) => guild.id === form.guildId)?.name;

  if (editing) {
    const kind = form.kind || 'user';
    return (
      <div className="ed-fields">
        <p className="ed-locked">
          <Icon name={KIND_ICON[kind]} filled />
          <span>
            <strong>{t(`type.kind.${kind}.title`)}</strong>
            {chosenName ? <span className="ed-sub">{chosenName}</span> : null}
          </span>
        </p>
        <p className="ed-hint">{t('type.locked')}</p>
      </div>
    );
  }

  return (
    <div className="ed-fields">
      <FieldBox name="kind" error={err('kind')}>
        <fieldset className="ed-choices ed-kinds">
          <legend className="ed-sr-only">{t('type.legend')}</legend>
          {kinds.map((kind) => (
            <label key={kind} className={`ed-kind${form.kind === kind ? ' is-selected' : ''}`}>
              <md-radio
                name="kind"
                value={kind}
                checked={form.kind === kind}
                aria-label={t(`type.kind.${kind}.title`)}
                onchange={() =>
                  set({kind, guildId: kind === 'guild' ? form.guildId : '', botId: kind === 'bot' ? form.botId : ''})
                }
              />
              <Icon name={KIND_ICON[kind]} filled />
              <span className="ed-choice-text">
                <span className="ed-choice-title">{t(`type.kind.${kind}.title`)}</span>
                <span className="ed-choice-hint">{t(`type.kind.${kind}.hint`)}</span>
              </span>
            </label>
          ))}
        </fieldset>
      </FieldBox>

      {form.kind === 'guild' && (
        <FieldBox name="guildId" error={err('guildId')}>
          <fieldset className="ed-choices">
            <legend>{t('type.guildLegend')}</legend>
            <GuildChoices guilds={guilds} value={form.guildId} onChange={(guildId) => set({guildId})} />
          </fieldset>
        </FieldBox>
      )}
      {form.kind === 'bot' && (
        <FieldBox name="botId" error={err('botId')}>
          <fieldset className="ed-choices">
            <legend>{t('type.botLegend')}</legend>
            <BotChoices bots={bots} value={form.botId} onChange={(botId) => set({botId})} />
          </fieldset>
        </FieldBox>
      )}
    </div>
  );
}

/** The bots the person manages; `stale` (Discord silent) is "could not check", never "none". */
function BotChoices({
  bots,
  value,
  onChange,
}: {
  bots: UseQueryResult<MyBotsResponse>;
  value: string;
  onChange: (id: string) => void;
}) {
  const {t} = useT('editor');
  if (bots.isPending) return <p className="ed-hint">{t('type.loadingBots')}</p>;
  if (bots.isError) return <ErrorState compact error={bots.error} onRetry={() => void bots.refetch()} />;
  if (bots.data.stale) {
    return (
      <EmptyState
        compact
        icon="cloud_off"
        title={t('type.botsStale.title')}
        action={
          <md-outlined-button disabled={bots.isFetching} onclick={() => void bots.refetch()}>
            {t('type.botsStale.retry')}
          </md-outlined-button>
        }
      >
        {t('type.botsStale.body')}
      </EmptyState>
    );
  }
  if (bots.data.items.length === 0) {
    return (
      <EmptyState
        compact
        icon="smart_toy"
        title={t('type.noBots.title')}
        action={
          <LinkButton to={paths.botClaim()} variant="outlined">
            {t('type.addBot')}
          </LinkButton>
        }
      >
        {t('type.noBots.body')}
      </EmptyState>
    );
  }
  return (
    <ul className="ed-guilds">
      {bots.data.items.map((bot) => {
        const name = bot.name ?? t('type.unnamedBot');
        return (
          <li key={bot.id}>
            <label className="ed-choice">
              <md-radio
                name="bot"
                value={bot.id}
                checked={value === bot.id}
                aria-label={name}
                onchange={() => onChange(bot.id)}
              />
              <BotAvatar id={bot.id} src={bot.avatar_url} size="small" />
              <span className="ed-choice-title">{name}</span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}

function GuildChoices({
  guilds,
  value,
  onChange,
}: {
  guilds: UseQueryResult<MyGuild[]>;
  value: string;
  onChange: (id: string) => void;
}) {
  const {t} = useT('editor');
  if (guilds.isPending) return <p className="ed-hint">{t('type.loadingGuilds')}</p>;
  if (guilds.isError) return <ErrorState compact error={guilds.error} onRetry={() => void guilds.refetch()} />;
  if (guilds.data.length === 0) {
    return (
      <EmptyState
        compact
        icon="groups"
        title={t('type.noGuilds.title')}
        action={
          <LinkButton to={paths.guildClaim()} variant="outlined">
            {t('type.claim')}
          </LinkButton>
        }
      >
        {t('type.noGuilds.body')}
      </EmptyState>
    );
  }
  return (
    <ul className="ed-guilds">
      {guilds.data.map((guild) => {
        const name = guild.name ?? t('type.unnamedGuild');
        return (
          <li key={guild.id}>
            {guild.claimed ? (
              <label className="ed-choice">
                <md-radio
                  name="guild"
                  value={guild.id}
                  checked={value === guild.id}
                  aria-label={name}
                  onchange={() => onChange(guild.id)}
                />
                <GuildIcon id={guild.id} iconUrl={guild.icon_url} size="small" />
                <span className="ed-choice-title">{name}</span>
              </label>
            ) : (
              <div className="ed-choice is-disabled">
                <GuildIcon id={guild.id} iconUrl={guild.icon_url} size="small" />
                <span className="ed-choice-text">
                  <span className="ed-choice-title">{name}</span>
                  <span className="ed-choice-hint">{t('type.notClaimed')}</span>
                </span>
                <LinkButton to={paths.guildClaim()} variant="text">
                  {t('type.claim')}
                </LinkButton>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// 2. Content
// ---------------------------------------------------------------------------

export function ContentStep({form, set, err, catalog}: StepProps) {
  const {t} = useT('editor');
  const {title, description} = catalog.limits;
  return (
    <div className="ed-fields">
      <FieldBox name="title">
        <TextField
          label={t('content.title')}
          value={form.title}
          onValueChange={(value) => set({title: value})}
          maxLength={title.max}
          required
          supportingText={t('content.titleHint', {min: title.min, max: title.max})}
          errorText={err('title')}
        />
      </FieldBox>
      <FieldBox name="description">
        <TextField
          label={t('content.description')}
          value={form.description}
          onValueChange={(value) => set({description: value})}
          rows={9}
          maxLength={description.max}
          required
          supportingText={t('content.descriptionHint', {min: description.min, max: description.max})}
          errorText={err('description')}
        />
      </FieldBox>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3. Positions
// ---------------------------------------------------------------------------

export function PositionsStep({form, set, err, catalog}: StepProps) {
  const {t} = useT('editor');
  const {limits} = catalog;
  const hasOther = form.positions.includes('other');
  const labels = form.positionsOther;
  const setLabel = (index: number, value: string) =>
    set({positionsOther: labels.map((label, at) => (at === index ? value : label))});

  return (
    <div className="ed-fields">
      <CheckGroup
        name="positions"
        legend={t('positions.legend')}
        kind="positions"
        ids={catalog.positions.map((entry) => entry.id)}
        selected={form.positions}
        max={limits.max_positions}
        error={err('positions')}
        onChange={(positions) => set({positions})}
        onAdd={(id) => {
          if (id === 'other' && form.positionsOther.length === 0) set({positionsOther: ['']});
        }}
      />

      {hasOther && (
        <FieldBox name="positionsOther" error={err('positionsOther')}>
          <fieldset className="ed-group">
            <legend>
              {t('positions.otherLegend')}
              <span className="ed-count numeric">
                {t('count', {used: labels.length, max: limits.max_positions_other})}
              </span>
            </legend>
            <p className="ed-hint">{t('positions.otherHint', {max: limits.position_other_max_len})}</p>
            <div className="ed-stack">
              {labels.map((label, index) => (
                <div key={index} className="ed-inline" data-field={`positionsOther.${index}`}>
                  <TextField
                    label={t('positions.otherLabel', {n: index + 1})}
                    value={label}
                    onValueChange={(value) => setLabel(index, value)}
                    maxLength={limits.position_other_max_len}
                    errorText={err(`positionsOther.${index}`)}
                  />
                  <md-icon-button
                    aria-label={t('positions.removeOther', {n: index + 1})}
                    onclick={() => set({positionsOther: labels.filter((_, at) => at !== index)})}
                  >
                    <Icon name="close" />
                  </md-icon-button>
                </div>
              ))}
            </div>
            <div>
              <md-text-button
                disabled={labels.length >= limits.max_positions_other}
                onclick={() => set({positionsOther: [...labels, '']})}
              >
                <md-icon slot="icon" className="filled" aria-hidden="true">
                  add
                </md-icon>
                {t('positions.addOther')}
              </md-text-button>
            </div>
          </fieldset>
        </FieldBox>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 4. Requirements
// ---------------------------------------------------------------------------

export function RequirementsStep({form, set, err, catalog}: StepProps) {
  const {t} = useT('editor');
  const {label} = useCatalogLabel();
  const {limits} = catalog;
  const list = form.requirements;
  const update = (index: number, patch: Partial<RequirementDraft>) =>
    set({requirements: list.map((draft, at) => (at === index ? {...draft, ...patch} : draft))});
  const typeOptions: SelectOption[] = catalog.requirements.map((entry) => ({
    value: entry.id,
    label: label('requirements', entry.id, entry.label),
  }));

  return (
    <div className="ed-fields">
      <p className="ed-hint numeric">{t('requirements.counter', {used: list.length, max: limits.max_requirements})}</p>
      {err('requirements') && <FieldError>{err('requirements')}</FieldError>}

      {list.length === 0 ? (
        <p className="ed-empty">{t('requirements.none')}</p>
      ) : (
        <ul className="ed-requirements">
          {list.map((draft, index) => {
            const entry = catalog.requirements.find((candidate) => candidate.id === draft.type);
            const base = `requirements.${index}`;
            return (
              <li key={draft.key}>
                <div className="ed-requirement">
                  <div className="ed-requirement-head">
                    <strong>{t('requirements.item', {n: index + 1})}</strong>
                    <md-icon-button
                      aria-label={t('requirements.remove', {n: index + 1})}
                      onclick={() => set({requirements: list.filter((_, at) => at !== index)})}
                    >
                      <Icon name="delete" />
                    </md-icon-button>
                  </div>
                  <FieldBox name={`${base}.type`} error={err(`${base}.type`)}>
                    <Select
                      label={t('requirements.type')}
                      value={draft.type}
                      options={typeOptions}
                      onValueChange={(type) =>
                        set({
                          requirements: list.map((d, at) =>
                            at === index ? {...emptyRequirement(type), key: d.key} : d,
                          ),
                        })
                      }
                    />
                  </FieldBox>

                  {entry?.requires_label && (
                    <FieldBox name={`${base}.label`}>
                      <TextField
                        label={t('requirements.customLabel')}
                        value={draft.label}
                        onValueChange={(value) => update(index, {label: value})}
                        maxLength={entry.label_max_len ?? 80}
                        required
                        errorText={err(`${base}.label`)}
                      />
                    </FieldBox>
                  )}

                  {entry?.value_type === 'int' && (
                    <FieldBox name={`${base}.value`}>
                      <TextField
                        label={t('requirements.value')}
                        type="number"
                        inputMode="numeric"
                        value={draft.text}
                        onValueChange={(value) => update(index, {text: value})}
                        required
                        supportingText={t('requirements.range', {min: entry.min ?? 0, max: entry.max ?? 0})}
                        errorText={err(`${base}.value`)}
                      />
                    </FieldBox>
                  )}
                  {entry?.value_type === 'text' && (
                    <FieldBox name={`${base}.value`}>
                      <TextField
                        label={entry.requires_label ? t('requirements.customValue') : t('requirements.value')}
                        value={draft.text}
                        rows={2}
                        onValueChange={(value) => update(index, {text: value})}
                        maxLength={entry.max_len ?? 200}
                        required
                        errorText={err(`${base}.value`)}
                      />
                    </FieldBox>
                  )}
                  {entry?.value_type === 'bool' && (
                    <FieldBox name={`${base}.value`}>
                      <Switch
                        checked={draft.flag}
                        onCheckedChange={(flag) => update(index, {flag})}
                        label={draft.flag ? t('requirements.flagOn') : t('requirements.flagOff')}
                        ariaLabel={t('requirements.flagAria', {name: label('requirements', entry.id, entry.label)})}
                      />
                    </FieldBox>
                  )}
                  {entry?.value_type === 'languages' && (
                    <CheckGroup
                      name={`${base}.value`}
                      legend={t('requirements.languages')}
                      kind="languages"
                      ids={catalog.languages.map((language) => language.id)}
                      selected={draft.langs}
                      max={limits.max_languages}
                      error={err(`${base}.value`)}
                      onChange={(langs) => update(index, {langs})}
                    />
                  )}
                  {entry?.value_type === 'none' && <p className="ed-hint">{t('requirements.noValue')}</p>}

                  {entry && entry.verifiable !== 'no' && (
                    <div className="ed-verify">
                      <Checkbox
                        checked={draft.verified}
                        onCheckedChange={(verified) => update(index, {verified})}
                        label={t('requirements.verified')}
                      />
                      <p className="ed-hint">{t('requirements.verifiedHint')}</p>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div>
        <md-outlined-button
          disabled={list.length >= limits.max_requirements}
          onclick={() =>
            set({
              requirements: [
                ...list,
                {...emptyRequirement(catalog.requirements[0]?.id ?? ''), key: newRequirementKey()},
              ],
            })
          }
        >
          <md-icon slot="icon" className="filled" aria-hidden="true">
            add
          </md-icon>
          {t('requirements.add')}
        </md-outlined-button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 5. Application
// ---------------------------------------------------------------------------

export function ApplicationStep({form, set, err, catalog}: StepProps) {
  const {t} = useT('editor');
  const {label} = useCatalogLabel();
  const options: SelectOption[] = [
    {value: '', label: t('application.none')},
    ...catalog.application_types.map((entry) => ({
      value: entry.id,
      label: entry.available
        ? label('application_types', entry.id, entry.label)
        : t('application.soon', {name: label('application_types', entry.id, entry.label)}),
      disabled: !entry.available,
    })),
  ];
  const entry = catalog.application_types.find((candidate) => candidate.id === form.applicationType);

  return (
    <div className="ed-fields">
      <FieldBox name="application">
        <Select
          label={t('application.type')}
          value={form.applicationType}
          options={options}
          onValueChange={(applicationType) => set({applicationType})}
          errorText={err('application')}
          supportingText={form.applicationType === '' ? t('application.noneHint') : undefined}
        />
      </FieldBox>
      {entry?.needs_url && (
        <FieldBox name="application.url">
          <TextField
            label={t('application.url')}
            type="url"
            inputMode="url"
            autocomplete="url"
            value={form.applicationUrl}
            onValueChange={(applicationUrl) => set({applicationUrl})}
            maxLength={FIELD_LIMITS.link.urlMax}
            placeholder="https://"
            required
            supportingText={t('application.urlHint')}
            errorText={err('application.url')}
          />
        </FieldBox>
      )}
      {form.applicationType === 'discord_dm' && <p className="ed-hint">{t('application.dmHint')}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 6. Commitment, languages, time zone
// ---------------------------------------------------------------------------

export function CommitmentStep({form, set, err, catalog}: StepProps) {
  const {t} = useT('editor');
  const {label} = useCatalogLabel();
  const {commitment} = FIELD_LIMITS;
  const zone = browserTimezone();
  const compensation: SelectOption[] = [
    {value: '', label: t('commitment.compensationNone')},
    ...catalog.compensations.map((entry) => ({value: entry.id, label: label('compensations', entry.id, entry.label)})),
  ];

  return (
    <div className="ed-fields">
      <div className="ed-grid">
        <FieldBox name="commitment.hours_per_week">
          <TextField
            label={t('commitment.hours')}
            type="number"
            inputMode="numeric"
            value={form.hours}
            onValueChange={(hours) => set({hours})}
            supportingText={t('commitment.hoursHint', {min: commitment.hoursMin, max: commitment.hoursMax})}
            errorText={err('commitment.hours_per_week')}
          />
        </FieldBox>
        <FieldBox name="commitment.openings">
          <TextField
            label={t('commitment.openings')}
            type="number"
            inputMode="numeric"
            value={form.openings}
            onValueChange={(openings) => set({openings})}
            supportingText={t('commitment.openingsHint', {min: commitment.openingsMin, max: commitment.openingsMax})}
            errorText={err('commitment.openings')}
          />
        </FieldBox>
      </div>
      <FieldBox name="commitment.compensation" error={err('commitment.compensation')}>
        <Select
          label={t('commitment.compensation')}
          value={form.compensation}
          options={compensation}
          onValueChange={(value) => set({compensation: value})}
        />
      </FieldBox>

      <CheckGroup
        name="languages"
        legend={t('commitment.languages')}
        kind="languages"
        ids={catalog.languages.map((entry) => entry.id)}
        selected={form.languages}
        max={catalog.limits.max_languages}
        error={err('languages')}
        onChange={(languages) => set({languages})}
      />

      <FieldBox name="timezone">
        <TextField
          label={t('commitment.timezone')}
          value={form.timezone}
          onValueChange={(timezone) => set({timezone})}
          maxLength={FIELD_LIMITS.timezoneMax}
          placeholder="Europe/Paris"
          supportingText={t('commitment.timezoneHint')}
          errorText={err('timezone')}
        />
        {zone && form.timezone !== zone && (
          <md-text-button onclick={() => set({timezone: zone})}>
            <md-icon slot="icon" className="filled" aria-hidden="true">
              schedule
            </md-icon>
            {t('commitment.useBrowserZone', {zone})}
          </md-text-button>
        )}
      </FieldBox>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 7. Theme, tags, expiry, featured experience
// ---------------------------------------------------------------------------

interface ExtrasStepProps extends StepProps {
  experiences: UseQueryResult<ExperienceList>;
  now: Date;
}

export function ExtrasStep({form, set, err, catalog, experiences, now}: ExtrasStepProps) {
  const {t} = useT('editor');
  const {label} = useCatalogLabel();
  const language = useLanguage();
  const {limits} = catalog;
  const bounds = expiryBounds(now, limits.post_max_expiry_days);
  const themeOptions: SelectOption[] = [
    {value: '', label: t('extras.themeNone')},
    ...catalog.themes.map((entry) => ({value: entry.id, label: label('themes', entry.id, entry.label)})),
  ];
  const verified = experiences.data?.items.filter((experience) => experience.verification.status === 'verified') ?? [];
  const experienceOptions: SelectOption[] = [
    {value: '', label: t('extras.featuredNone')},
    ...verified.map((experience) => ({
      value: experience.id,
      label: `${experience.name} · ${experience.position === 'other' ? (experience.position_other ?? '') : label('positions', experience.position)}`,
    })),
  ];
  // A stored id that is not (or no longer) a verified experience stays visible so that it can be cleared.
  if (form.featuredExperienceId && !verified.some((experience) => experience.id === form.featuredExperienceId)) {
    experienceOptions.push({value: form.featuredExperienceId, label: t('extras.featuredUnknown')});
  }

  return (
    <div className="ed-fields">
      <FieldBox name="theme" error={err('theme')}>
        <Select
          label={t('extras.theme')}
          value={form.theme}
          options={themeOptions}
          onValueChange={(theme) => set({theme})}
          supportingText={form.theme === 'nsfw' ? t('extras.themeNsfw') : undefined}
        />
      </FieldBox>

      <TagsField form={form} set={set} err={err} catalog={catalog} />

      <FieldBox name="expiresOn">
        <TextField
          label={t('extras.expiry')}
          type="date"
          value={form.expiresOn}
          onValueChange={(expiresOn) => set({expiresOn})}
          supportingText={
            form.expiresOn === ''
              ? t('extras.expiryNever', {
                  min: formatDate(`${bounds.min}T12:00:00`, 'medium', language),
                  max: formatDate(`${bounds.max}T12:00:00`, 'medium', language),
                })
              : t('extras.expiryRange', {
                  min: formatDate(`${bounds.min}T12:00:00`, 'medium', language),
                  max: formatDate(`${bounds.max}T12:00:00`, 'medium', language),
                })
          }
          errorText={err('expiresOn')}
        />
        {form.expiresOn !== '' && (
          <md-text-button onclick={() => set({expiresOn: ''})}>
            <md-icon slot="icon" className="filled" aria-hidden="true">
              event_busy
            </md-icon>
            {t('extras.expiryClear')}
          </md-text-button>
        )}
      </FieldBox>

      {form.kind === 'user' && (
        <FieldBox name="featuredExperienceId">
          {experiences.isPending ? (
            <p className="ed-hint">{t('extras.featuredLoading')}</p>
          ) : experiences.isError ? (
            <ErrorState compact error={experiences.error} onRetry={() => void experiences.refetch()} />
          ) : (
            <>
              <Select
                label={t('extras.featured')}
                value={form.featuredExperienceId}
                options={experienceOptions}
                onValueChange={(featuredExperienceId) => set({featuredExperienceId})}
                errorText={err('featuredExperienceId')}
              />
              {verified.length === 0 && (
                <p className="ed-hint">
                  {t('extras.featuredEmpty')}{' '}
                  <LinkButton to={paths.myExperiences()} variant="text">
                    {t('extras.featuredLink')}
                  </LinkButton>
                </p>
              )}
            </>
          )}
        </FieldBox>
      )}
    </div>
  );
}

function TagsField({form, set, err, catalog}: Pick<StepProps, 'form' | 'set' | 'err' | 'catalog'>) {
  const {t} = useT('editor');
  const {limits} = catalog;
  const [draft, setDraft] = useState('');

  const add = () => {
    const parts = draft
      .split(/[,\s]+/)
      .map(normalizeTag)
      .filter(Boolean);
    if (parts.length === 0) return;
    const next = [...form.tags];
    for (const tag of parts) if (!next.includes(tag) && next.length < limits.max_tags) next.push(tag);
    set({tags: next});
    setDraft('');
  };

  return (
    <FieldBox name="tags" error={err('tags')}>
      <div
        className="ed-inline ed-inline-end"
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            add();
          }
        }}
      >
        <TextField
          label={t('extras.tags')}
          value={draft}
          onValueChange={setDraft}
          maxLength={24}
          disabled={form.tags.length >= limits.max_tags}
          supportingText={t('extras.tagsHint', {max: limits.max_tags})}
        />
        <md-outlined-button disabled={draft.trim() === '' || form.tags.length >= limits.max_tags} onclick={add}>
          {t('extras.tagAdd')}
        </md-outlined-button>
      </div>
      {form.tags.length > 0 && (
        <ul className="ed-tags" aria-label={t('extras.tagsList')}>
          {form.tags.map((tag, index) => (
            <li key={tag} data-field={`tags.${index}`}>
              <Chip mono className={err(`tags.${index}`) ? 'is-invalid' : undefined}>
                {tag}
                <md-icon-button
                  className="ed-tag-remove"
                  aria-label={t('extras.tagRemove', {tag})}
                  onclick={() => set({tags: form.tags.filter((value) => value !== tag)})}
                >
                  <Icon name="close" />
                </md-icon-button>
              </Chip>
            </li>
          ))}
        </ul>
      )}
      {form.tags.map((tag, index) => {
        const message = err(`tags.${index}`);
        return message ? (
          <FieldError key={tag}>
            {tag}: {message}
          </FieldError>
        ) : null;
      })}
    </FieldBox>
  );
}
