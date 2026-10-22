import {useEffect, useMemo, useRef, useState} from 'react';
import {useNavigate, useParams, useSearchParams} from 'react-router';

import {useCatalogLabel} from '@/api/catalog';
import {isApiError} from '@/api/client';
import {errorMessage, issueMessage} from '@/api/errors';
import {useCreatePost, usePublishPost, useUpdatePost} from '@/api/mutations';
import {useCatalog, useMyExperiences, useMyGuilds, usePost} from '@/api/queries';
import type {Catalog, Post} from '@/api/types';
import {paths} from '@/app/paths';
import {usePageTitle} from '@/app/usePageTitle';
import {registerBeforeLogin} from '@/auth/beforeLogin';
import {useSession} from '@/auth/session';
import {useAuthAction} from '@/auth/useAuthAction';
import {EmptyState, ErrorState, RelativeTime} from '@/components';
import {useUserQuota} from '@/features/my-posts/useUserQuota';
import {useLanguage} from '@/i18n/useLanguage';
import {useT} from '@/i18n/useT';
import {getItem, removeItem, setItem} from '@/lib/storage';
import {GuildIcon} from '@/components/GuildIcon';
import {DisplayName} from '@/components';
import {defaultAvatarUrl} from '@/lib/discord';
import {
  Avatar,
  type DashboardContext,
  Dropdown,
  Icon,
  LinkButton,
  ME_CONTEXT,
  PageLoading,
  SettingsLayout,
  SettingsPanel,
  useSnackbar,
  VisuallyHidden,
} from '@/ui';

import './editor.css';
import {useIssueText} from './useIssueText';
import {
  draftKey,
  EMPTY_FORM,
  formFromPost,
  type FormState,
  formsEqual,
  isStoredDraft,
  type Issues,
  mapServerIssues,
  mergeStoredForm,
  stepOfField,
  STEP_IDS,
  stepsFor,
  type StepId,
  toCreateBody,
  toUpdateBody,
  validateAll,
} from './form';
import {PostPreview} from './PostPreview';
import {ReviewStep, SubmitBanner, type ReviewRow} from './Review';
import {
  ApplicationStep,
  CommitmentStep,
  ContentStep,
  ExtrasStep,
  PositionsStep,
  RequirementsStep,
  type StepProps,
  TypeStep,
} from './steps';

/** /posts/new and /posts/:postId/edit. */
export function Component() {
  const {t} = useT('editor');
  const {postId} = useParams();
  usePageTitle(postId ? t('titleEdit') : t('titleNew'));
  const catalog = useCatalog();
  const post = usePost(postId);
  const [searchParams] = useSearchParams();
  const guilds = useMyGuilds();
  const guildParam = searchParams.get('guild');

  // `?guild=` fixes the author: know whether it is one of my servers before showing the form.
  if (catalog.isPending || (postId && post.isPending) || (!postId && guildParam && guilds.isPending))
    return <PageLoading />;
  if (catalog.isError)
    return (
      <Shell editing={postId !== undefined}>
        <ErrorState error={catalog.error} onRetry={() => void catalog.refetch()} />
      </Shell>
    );
  const data = post.data;
  if (postId) {
    if (post.isError || !data)
      return (
        <Shell editing={postId !== undefined}>
          <ErrorState error={post.error ?? new Error('missing')} onRetry={() => void post.refetch()} />
        </Shell>
      );
    if (data.status === 'hidden') {
      return (
        <Shell editing={postId !== undefined}>
          <EmptyState
            icon="visibility_off"
            title={t('locked.hiddenTitle')}
            tone="secondary"
            shape="octagon"
            action={<LinkButton to={paths.myPosts()}>{t('locked.myPosts')}</LinkButton>}
          >
            {t('locked.hiddenBody')}
            {data.hidden_reason ? ` ${t('locked.reason', {reason: data.hidden_reason})}` : ''}
          </EmptyState>
        </Shell>
      );
    }
    if (!data.can_edit) {
      return (
        <Shell editing={postId !== undefined}>
          <EmptyState
            icon="lock"
            title={t('locked.forbiddenTitle')}
            action={<LinkButton to={paths.post(data.id)}>{t('locked.view')}</LinkButton>}
          >
            {t('locked.forbiddenBody')}
          </EmptyState>
        </Shell>
      );
    }
  }
  const fixedGuildId =
    !postId && guildParam && guilds.data?.some((entry) => entry.claimed && entry.id === guildParam) ? guildParam : null;
  return (
    <EditorForm
      key={postId ?? 'new'}
      catalog={catalog.data}
      initialPost={postId ? data : undefined}
      fixedGuildId={fixedGuildId}
    />
  );
}

function Shell({children, editing}: {children: React.ReactNode; editing: boolean}) {
  const {t} = useT('editor');
  return <SettingsLayout title={editing ? t('titleEdit') : t('titleNew')}>{children}</SettingsLayout>;
}

// ---------------------------------------------------------------------------
// The form
// ---------------------------------------------------------------------------

/** Which code points at which field, when the API names no field. */
const FIELD_BY_CODE: Record<string, {field: string; step: StepId}> = {
  lineup_form_unavailable: {field: 'application', step: 'application'},
  lineup_positions_other_required: {field: 'positionsOther', step: 'positions'},
  lineup_positions_other_unexpected: {field: 'positionsOther', step: 'positions'},
  lineup_experience_not_found: {field: 'featuredExperienceId', step: 'extras'},
  lineup_experience_not_verified: {field: 'featuredExperienceId', step: 'extras'},
  lineup_featured_experience_user_only: {field: 'featuredExperienceId', step: 'extras'},
  lineup_post_expired: {field: 'expiresOn', step: 'extras'},
};
const CLAIM_CODES = ['lineup_guild_profile_missing', 'guild_suspended', 'lineup_guild_forbidden'];

/** Editing: the sections of a post, each with its icon (no steps, no review). */
const SECTION_ICONS: Record<StepId, string> = {
  type: 'person',
  content: 'description',
  positions: 'groups',
  requirements: 'checklist',
  application: 'send',
  commitment: 'schedule',
  extras: 'tune',
  review: 'fact_check',
};

type SubmitMode = 'publish' | 'draft';

function focusField(name: string) {
  window.requestAnimationFrame(() => {
    const box = document.querySelector<HTMLElement>(`[data-field="${name}"]`);
    const target = box?.querySelector<HTMLElement>(
      'md-outlined-text-field, .select-trigger, md-checkbox, md-radio, md-switch, md-icon-button, md-text-button',
    );
    (target ?? box)?.focus();
  });
}

function EditorForm({
  catalog,
  initialPost,
  fixedGuildId,
}: {
  catalog: Catalog;
  initialPost: Post | undefined;
  /** The server the dashboard context fixes as the author of a new post. */
  fixedGuildId: string | null;
}) {
  const {t} = useT('editor');
  const {t: tErrors} = useT('errors');
  const {t: tCommon} = useT('common');
  const {label} = useCatalogLabel();
  const language = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const snackbar = useSnackbar();
  const auth = useAuthAction();
  const {canWrite} = useSession();
  const issueText = useIssueText();

  const guilds = useMyGuilds();
  const experiences = useMyExperiences();
  const create = useCreatePost();
  const update = useUpdatePost();
  const publish = usePublishPost();
  const quota = useUserQuota();

  const editing = initialPost !== undefined;
  const key = draftKey(initialPost?.id);
  const [base, setBase] = useState<Post | undefined>(initialPost);
  // `?kind=user` (from the candidates page) starts a personal post: the type step is skipped.
  const presetUser = !editing && fixedGuildId === null && searchParams.get('kind') === 'user';
  // `?kind=guild` (from the projects page) preselects a server post; the type step stays to pick the server.
  const presetGuild = !editing && fixedGuildId === null && searchParams.get('kind') === 'guild';
  // Something fixes the author (the post, a server's dashboard, the personal one): no type step.
  const typeFixed = editing || presetUser || fixedGuildId !== null;
  // Editing shows sections to jump between, without the review: every section can be saved.
  const steps = useMemo(() => stepsFor(typeFixed).filter((id) => !editing || id !== 'review'), [typeFixed, editing]);
  const pristine = useMemo(
    () =>
      base
        ? formFromPost(base)
        : fixedGuildId
          ? {...EMPTY_FORM, kind: 'guild' as const, guildId: fixedGuildId}
          : presetUser
            ? {...EMPTY_FORM, kind: 'user' as const}
            : presetGuild
              ? {...EMPTY_FORM, kind: 'guild' as const}
              : EMPTY_FORM,
    [base, presetUser, presetGuild, fixedGuildId],
  );
  const focusExpiry = editing && searchParams.get('focus') === 'expiry';
  const firstStep: StepId = focusExpiry ? 'extras' : steps[0]!;

  // A form saved in this browser comes back, with a notice.
  const [restored] = useState(() => {
    const stored = getItem<unknown>(key, null);
    if (!isStoredDraft(stored)) return null;
    const saved = mergeStoredForm(stored.form);
    return formsEqual(saved, pristine) ? null : {form: saved, step: stored.step, savedAt: stored.savedAt};
  });
  const [restoredAt, setRestoredAt] = useState<number | null>(restored?.savedAt ?? null);
  const [form, setForm] = useState<FormState>(restored?.form ?? pristine);
  const [step, setStep] = useState<StepId>(restored && steps.includes(restored.step) ? restored.step : firstStep);
  const [visited, setVisited] = useState<Set<StepId>>(
    () => new Set<StepId>(editing ? STEP_IDS.filter((id) => id !== 'review') : typeFixed ? ['type'] : []),
  );
  const [showErrors, setShowErrors] = useState<Set<StepId>>(() => new Set());
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [lastMode, setLastMode] = useState<SubmitMode>('publish');
  const finished = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const [now] = useState(() => new Date());

  // The local draft: written shortly after each change, and at once before signing in.
  useEffect(() => {
    const save = () => {
      if (finished.current) return;
      if (formsEqual(form, pristine)) removeItem(key);
      else setItem(key, {version: 1, savedAt: Date.now(), step, form});
    };
    const timer = window.setTimeout(save, 400);
    const unregister = registerBeforeLogin(save);
    return () => {
      window.clearTimeout(timer);
      unregister();
    };
  }, [form, step, pristine, key]);

  // `?focus=expiry` (from the banner of an expired post) opens the expiry field.
  useEffect(() => {
    if (focusExpiry) focusField('expiresOn');
  }, [focusExpiry]);

  const rules = useMemo(
    () => ({
      catalog,
      now,
      unchangedExpiry: base ? pristine.expiresOn : undefined,
      claimedGuildIds: guilds.data?.filter((guild) => guild.claimed).map((guild) => guild.id),
      verifiedExperienceIds: experiences.data?.items
        .filter((experience) => experience.verification.status === 'verified')
        .map((experience) => experience.id),
    }),
    [catalog, now, base, pristine.expiresOn, guilds.data, experiences.data],
  );
  const issues = useMemo(() => validateAll(form, rules, editing), [form, rules, editing]);

  const err = (field: string): string | undefined => {
    const owner = stepOfField(field);
    const client = owner && showErrors.has(owner) ? (issues[owner] as Issues | undefined)?.[field] : undefined;
    return client ? issueText(client) : serverErrors[field];
  };

  const set = (patch: Partial<FormState>) => {
    setForm((current) => ({...current, ...patch}));
    setServerErrors((current) => {
      const next = Object.fromEntries(Object.entries(current).filter(([field]) => stepOfField(field) !== step));
      return Object.keys(next).length === Object.keys(current).length ? current : next;
    });
  };

  const go = (target: StepId, focus?: string) => {
    setVisited((current) => new Set(current).add(step));
    setStep(target);
    window.requestAnimationFrame(() => {
      if (focus) focusField(focus);
      else heading.current?.focus({preventScroll: true});
      heading.current?.scrollIntoView({block: 'start'});
    });
  };

  const index = steps.indexOf(step);
  const first = (stepIssues: Issues | undefined) => Object.keys(stepIssues ?? {})[0];

  const next = () => {
    const stepIssues = issues[step];
    if (stepIssues) {
      setShowErrors((current) => new Set(current).add(step));
      focusField(first(stepIssues)!);
      return;
    }
    go(steps[Math.min(index + 1, steps.length - 1)]!);
  };
  const previous = () => go(steps[Math.max(index - 1, 0)]!);

  const discard = () => {
    removeItem(key);
    setForm(pristine);
    setStep(firstStep);
    setRestoredAt(null);
    setShowErrors(new Set());
    setServerErrors({});
  };

  // -- Submit -----------------------------------------------------------------

  const failWith = (error: unknown) => {
    if (isApiError(error) && error.validation && error.validation.length > 0) {
      const mapped = mapServerIssues(error.validation);
      const messages: Record<string, string> = {};
      for (const entry of mapped)
        if (entry.step !== 'review') messages[entry.field] ??= issueMessage(entry.issue, tErrors);
      setServerErrors(messages);
      const stepsWithIssues = mapped
        .map((entry) => entry.step)
        .filter((id): id is Exclude<StepId, 'review'> => id !== 'review');
      if (stepsWithIssues.length < mapped.length) setBanner(error);
      if (stepsWithIssues.length > 0) {
        const target = STEP_IDS.find((id) => id !== 'review' && stepsWithIssues.includes(id))!;
        const field = mapped.find((entry) => entry.step === target)!.field;
        setShowErrors((current) => new Set([...current, ...stepsWithIssues]));
        go(target, field);
      }
      return;
    }
    const code = isApiError(error) ? error.code : null;
    const pointed = code ? FIELD_BY_CODE[code] : undefined;
    if (pointed) {
      setServerErrors({[pointed.field]: errorMessage(error, tErrors)});
      setShowErrors((current) => new Set(current).add(pointed.step));
      go(pointed.step, pointed.field);
      return;
    }
    setBanner(error);
    window.requestAnimationFrame(() => document.querySelector('.ed-banner')?.scrollIntoView({block: 'center'}));
    if (code && CLAIM_CODES.includes(code) && !typeFixed) go('type');
  };

  const submit = async (mode: SubmitMode) => {
    setLastMode(mode);
    setBanner(null);
    const all = validateAll(form, rules, editing);
    const bad = STEP_IDS.find((id) => all[id]);
    if (bad) {
      setShowErrors(new Set(STEP_IDS));
      go(bad, first(all[bad]));
      return;
    }
    setBusy(true);
    let saved: Post | undefined = base;
    try {
      const result = await auth.run(async () => {
        if (!editing || !base) {
          return create.mutateAsync(
            toCreateBody(form, catalog, new Date(), mode === 'publish' ? 'published' : 'draft'),
          );
        }
        const body = toUpdateBody(form, base, catalog, new Date());
        let post: Post = base;
        if (Object.keys(body).length > 0) {
          post = await update.mutateAsync({postId: base.id, body});
          saved = post;
          setBase(post);
        }
        if (mode === 'publish' && post.status !== 'published') post = await publish.mutateAsync(post.id);
        return post;
      });
      if (!result) return;
      finished.current = true;
      removeItem(key);
      const message =
        result.status === 'published'
          ? editing && initialPost?.status === 'published'
            ? t('done.saved')
            : t('done.published')
          : t('done.draft');
      snackbar.show({message});
      void navigate(paths.post(result.id));
    } catch (error) {
      if (saved && saved !== base) setBase(saved);
      failWith(error);
    } finally {
      setBusy(false);
    }
  };

  // -- Rows of the review -----------------------------------------------------

  const guild = guilds.data?.find((entry) => entry.id === form.guildId);
  const summaries: Record<Exclude<StepId, 'review'>, string> = {
    type:
      form.kind === 'guild'
        ? t('review.summary.guild', {name: guild?.name ?? base?.guild?.name ?? t('type.unnamedGuild')})
        : form.kind === 'user'
          ? t('review.summary.user')
          : t('review.empty'),
    content: form.title.trim() || t('review.empty'),
    positions:
      form.positions
        .map((id) =>
          id === 'other' && form.positionsOther.length > 0 ? form.positionsOther.join(', ') : label('positions', id),
        )
        .join(', ') || t('review.empty'),
    requirements: t('review.summary.requirements', {count: form.requirements.length}),
    application:
      form.applicationType === ''
        ? t('application.none')
        : form.applicationType === 'external_url'
          ? form.applicationUrl || label('application_types', form.applicationType)
          : label('application_types', form.applicationType),
    commitment:
      [
        form.hours && t('review.summary.hours', {count: Number(form.hours)}),
        form.compensation && label('compensations', form.compensation),
        form.openings && t('review.summary.openings', {count: Number(form.openings)}),
        form.languages.length > 0 && t('review.summary.languages', {count: form.languages.length}),
        form.timezone,
      ]
        .filter(Boolean)
        .join(' · ') || t('review.empty'),
    extras: [
      form.theme && label('themes', form.theme),
      form.tags.length > 0 && t('review.summary.tags', {count: form.tags.length}),
      form.expiresOn
        ? t('review.summary.expires', {
            date: new Intl.DateTimeFormat(language, {dateStyle: 'medium'}).format(
              new Date(`${form.expiresOn}T12:00:00`),
            ),
          })
        : t('review.summary.never'),
      form.featuredExperienceId && t('review.summary.featured'),
    ]
      .filter(Boolean)
      .join(' · '),
  };
  const stateOf = (id: StepId): 'done' | 'error' | 'todo' => {
    if (issues[id]) return visited.has(id) || id === 'review' ? 'error' : 'todo';
    return visited.has(id) ? 'done' : 'todo';
  };
  const rows: ReviewRow[] = STEP_IDS.filter((id): id is Exclude<StepId, 'review'> => id !== 'review')
    .filter((id) => steps.includes(id))
    .map((id) => ({
      step: id,
      title: t(`steps.${id}.title`),
      summary: summaries[id]!,
      state: Object.keys(issues[id] ?? {}).length > 0 ? 'error' : 'done',
    }));

  const status = base?.status;
  const willPublish = !editing || status !== 'published';
  const userLimit = catalog.limits.max_published_posts_per_user;

  const stepProps: StepProps = {form, set, err, catalog, editing};

  const visibleSteps = steps;
  // Whose dashboard this is: the server of the post (or of `?guild=`), else the person.
  const authorGuildId = form.kind === 'guild' && form.guildId !== '' ? form.guildId : null;
  const context: DashboardContext = typeFixed && authorGuildId ? {kind: 'guild', guildId: authorGuildId} : ME_CONTEXT;
  const position = visibleSteps.indexOf(step) + 1;
  const stepName = t(`steps.${step}.short`);
  const canPublish = !editing || status !== 'published';

  const unchanged = formsEqual(form, pristine);
  const cancelEdit = () => {
    finished.current = true;
    removeItem(key);
    if (base) void navigate(paths.post(base.id));
  };

  const actions = editing ? (
    <>
      <md-outlined-button disabled={busy} onclick={cancelEdit}>
        {tCommon('actions.cancel')}
      </md-outlined-button>
      {canPublish ? (
        <>
          <md-outlined-button disabled={busy || !canWrite || unchanged} onclick={() => void submit('draft')}>
            {busy && lastMode === 'draft' ? t('actions.sending') : t('actions.saveEdit')}
          </md-outlined-button>
          <md-filled-button disabled={busy || !canWrite} onclick={() => void submit('publish')}>
            {busy && lastMode === 'publish'
              ? t('actions.sending')
              : status === 'closed'
                ? t('actions.republish')
                : t('actions.publish')}
          </md-filled-button>
        </>
      ) : (
        <md-filled-button disabled={busy || !canWrite || unchanged} onclick={() => void submit('draft')}>
          {busy ? t('actions.sending') : t('actions.saveChanges')}
        </md-filled-button>
      )}
    </>
  ) : step === 'review' ? (
    <>
      <md-outlined-button disabled={busy} onclick={previous}>
        {t('actions.previous')}
      </md-outlined-button>
      {canPublish && (
        <md-outlined-button disabled={busy || !canWrite} onclick={() => void submit('draft')}>
          {busy && lastMode === 'draft'
            ? t('actions.sending')
            : editing
              ? t('actions.saveEdit')
              : t('actions.saveDraft')}
        </md-outlined-button>
      )}
      {canPublish ? (
        <md-filled-button disabled={busy || !canWrite} onclick={() => void submit('publish')}>
          {busy && lastMode === 'publish'
            ? t('actions.sending')
            : status === 'closed'
              ? t('actions.republish')
              : t('actions.publish')}
        </md-filled-button>
      ) : (
        <md-filled-button disabled={busy || !canWrite} onclick={() => void submit('draft')}>
          {busy ? t('actions.sending') : t('actions.saveChanges')}
        </md-filled-button>
      )}
    </>
  ) : (
    <>
      {index > 0 && <md-outlined-button onclick={previous}>{t('actions.previous')}</md-outlined-button>}
      <md-filled-button onclick={next}>{t('actions.next')}</md-filled-button>
    </>
  );

  return (
    <SettingsLayout title={editing ? t('titleEdit') : t('titleNew')} className="ed-page" context={context}>
      <EditorAuthor
        guildId={authorGuildId}
        fallbackName={base?.guild?.name ?? null}
        fallbackIcon={base?.guild?.icon_url ?? null}
      />

      {restoredAt !== null && (
        <div className="ed-restored" role="status">
          <Icon name="restore" filled />
          <p>
            {t('restored.text')} <RelativeTime value={new Date(restoredAt).toISOString()} />
          </p>
          <md-text-button onclick={discard}>{t('restored.discard')}</md-text-button>
        </div>
      )}

      {editing ? (
        <div className="ed-sections-compact">
          <Dropdown
            label={t('sections.label')}
            matchTrigger
            items={visibleSteps.map((id) => ({
              key: id,
              label: t(`steps.${id}.short`),
              icon: stateOf(id) === 'error' ? 'error' : SECTION_ICONS[id],
              selected: id === step,
              onSelect: () => go(id),
            }))}
            trigger={({ref, onActivate, ...aria}) => (
              <md-outlined-button {...aria} ref={ref} trailing-icon onclick={onActivate}>
                <Icon name={SECTION_ICONS[step]} />
                <span className="settings-compact-label">{stepName}</span>
                <md-icon slot="icon">expand_more</md-icon>
              </md-outlined-button>
            )}
          />
        </div>
      ) : (
        <div className="ed-progress">
          <p className="ed-progress-text numeric">
            {t('stepper.compact', {current: position, total: visibleSteps.length, name: stepName})}
          </p>
          <md-linear-progress value={position} max={visibleSteps.length} aria-hidden="true" />
        </div>
      )}

      <div className="ed-body">
        <nav className="ed-stepper-nav" aria-label={editing ? t('sections.label') : t('stepper.label')}>
          <ol className={editing ? 'ed-stepper is-sections' : 'ed-stepper'}>
            {visibleSteps.map((id) => {
              const state = stateOf(id);
              const current = id === step;
              const icon = editing
                ? state === 'error'
                  ? 'error'
                  : SECTION_ICONS[id]
                : current
                  ? 'edit'
                  : state === 'error'
                    ? 'error'
                    : state === 'done'
                      ? 'check_circle'
                      : 'radio_button_unchecked';
              // Editing: no progress to tell, only a section to fix.
              const hidden = editing ? (state === 'error' ? 'error' : null) : current ? 'current' : state;
              return (
                <li key={id} className={`ed-step is-${current ? 'current' : state}`}>
                  <button
                    type="button"
                    aria-current={current ? (editing ? 'true' : 'step') : undefined}
                    onClick={() => go(id)}
                  >
                    <Icon name={icon} filled />
                    <span className="ed-step-label">{t(`steps.${id}.short`)}</span>
                    {hidden && <VisuallyHidden> {t(`stepper.state.${hidden}`)}</VisuallyHidden>}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <SettingsPanel
          className="ed-panel"
          title={
            <span ref={heading} tabIndex={-1} className="ed-panel-title">
              {t(`steps.${step}.title`)}
            </span>
          }
          description={t(`steps.${step}.intro`)}
          actions={actions}
        >
          {banner !== null && (
            <SubmitBanner
              error={banner}
              editing={editing}
              busy={busy}
              onRetry={() => void submit(lastMode)}
              onSaveDraft={() => void submit('draft')}
            />
          )}

          {step === 'type' && <TypeStep {...stepProps} guilds={guilds} />}
          {step === 'content' && <ContentStep {...stepProps} />}
          {step === 'positions' && <PositionsStep {...stepProps} />}
          {step === 'requirements' && <RequirementsStep {...stepProps} />}
          {step === 'application' && <ApplicationStep {...stepProps} />}
          {step === 'commitment' && <CommitmentStep {...stepProps} />}
          {step === 'extras' && <ExtrasStep {...stepProps} experiences={experiences} now={now} />}
          {step === 'review' && (
            <ReviewStep
              rows={rows}
              onGo={(id) => {
                setShowErrors((current) => new Set(current).add(id));
                go(id, Object.keys(issues[id] ?? {})[0]);
              }}
              quota={form.kind === 'user' && willPublish && quota.ready ? {used: quota.used, limit: userLimit} : null}
              preview={<PostPreview title={form.title} description={form.description} />}
            />
          )}
        </SettingsPanel>
      </div>
    </SettingsLayout>
  );
}

/** A discreet reminder of who the post is for: the server (icon and name) or you (avatar and name). */
function EditorAuthor({
  guildId,
  fallbackName,
  fallbackIcon,
}: {
  guildId: string | null;
  fallbackName: string | null;
  fallbackIcon: string | null;
}) {
  const {t} = useT('editor');
  const guilds = useMyGuilds();
  const {me} = useSession();
  if (guildId) {
    const entry = guilds.data?.find((guild) => guild.id === guildId);
    return (
      <p className="ed-author">
        <GuildIcon id={guildId} iconUrl={entry?.icon_url ?? fallbackIcon} size="small" />
        <span>{t('author.guild')}</span>
        <DisplayName name={entry?.name ?? fallbackName ?? t('type.unnamedGuild')} entity="guild" />
      </p>
    );
  }
  const user = me?.user;
  if (!user) return null;
  return (
    <p className="ed-author">
      <Avatar src={user.avatar_url ?? defaultAvatarUrl(user.id)} size="small" />
      <span>{t('author.user')}</span>
      <DisplayName name={user.global_name ?? user.username} badges={user.badges} entity="user" />
    </p>
  );
}
