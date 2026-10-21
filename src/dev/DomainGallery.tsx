/**
 * Development only: the domain components of src/components, each in a card
 * with sample data (src/dev/galleryData.ts). Part of /__ui; its strings are
 * not translated (the components' own are).
 */

import {useQueryClient} from '@tanstack/react-query';
import {type ReactNode, useState} from 'react';

import {catalogFixture} from '@/api/catalog.fixture';
import {ApiError} from '@/api/client';
import {queryKeys} from '@/api/queryKeys';
import {
  ApplicationAction,
  BadgeList,
  CommitmentSummary,
  EmptyState,
  ErrorState,
  ExpiryLabel,
  ExperienceRow,
  GuildIcon,
  InviteHelp,
  LanguageList,
  LinkList,
  NsfwConfirmDialog,
  NsfwGate,
  PostCard,
  PostStatusBadge,
  QuotaMeter,
  RelativeTime,
  ReportButton,
  ReportDialog,
  RequirementList,
  RetryButton,
  StaleNotice,
  TimezoneLabel,
  UserAvatar,
  VerificationPill,
} from '@/components';
import {resetNsfwConfirmed} from '@/components/nsfw';
import {Card, type CardProps, CardActions, CardVisual, Chip, Chips, LinkButton, Rows, Section, Stack} from '@/ui';

import {
  AVATAR,
  DECORATION_URL,
  EXPERIENCES,
  FIVE_MINUTES_AGO,
  GUILD_BADGES,
  GUILD_IDS,
  hoursAgo,
  ICON,
  inDays,
  LINKS,
  POST_GUILD,
  POST_LONG,
  POST_STATUSES,
  POST_USER,
  REQUIREMENTS,
  USER_BADGES,
  USER_ID,
  VIEWER,
} from './galleryData';

const SIZES = ['small', 'default', 'large', 'xl'] as const;
const list = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--page-gap)',
} as const;
const wrap = {display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--gap-l)'} as const;
const column = {display: 'flex', flexDirection: 'column', gap: 'var(--gap-l)', alignItems: 'flex-start'} as const;

type CardSpan = NonNullable<CardProps['span']>;

/** A titled card with a span (Section has none). */
function Block({title, span, children}: {title: string; span: CardSpan; children: ReactNode}) {
  return (
    <Card span={span} className="section">
      <div className="section-head">
        <h2>{title}</h2>
      </div>
      {children}
    </Card>
  );
}

export function DomainGallery() {
  // The components read the catalog from the query cache: seed it so no API is needed.
  const queryClient = useQueryClient();
  useState(() => {
    if (!queryClient.getQueryData(queryKeys.catalog())) queryClient.setQueryData(queryKeys.catalog(), catalogFixture);
  });

  const [report, setReport] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(false);
  const [limited] = useState(
    () => new ApiError({status: 429, kind: 'lineup', code: 'lineup_rate_limited', retryAfter: 45}),
  );
  const [unavailable] = useState(
    () => new ApiError({status: 503, kind: 'lineup', code: 'discord_unavailable', retryAfter: 30}),
  );
  const [missing] = useState(
    () => new ApiError({status: 404, kind: 'lineup', code: 'lineup_post_not_found', serverMessage: 'x'}),
  );
  const [offline] = useState(() => new ApiError({status: 0, kind: 'network', code: 'network_error'}));

  return (
    <>
      <Card variant="hero">
        <h1>Domain components</h1>
        <p>The shared pieces of src/components, with sample data. Switch language and theme from the app bar.</p>
      </Card>

      <Card span={6}>
        <h2>UserAvatar</h2>
        <CardVisual>
          <div style={wrap}>
            {SIZES.map((size) => (
              <UserAvatar key={size} id={USER_ID} src={AVATAR} size={size} />
            ))}
          </div>
          <div style={wrap}>
            {SIZES.map((size) => (
              <UserAvatar key={size} id={USER_ID} src={AVATAR} size={size} decoration={{url: DECORATION_URL}} />
            ))}
          </div>
          <div style={wrap}>
            {SIZES.map((size) => (
              <UserAvatar key={size} id="345678901234567891" size={size} />
            ))}
          </div>
        </CardVisual>
      </Card>

      <Card span={6}>
        <h2>GuildIcon</h2>
        <CardVisual>
          <div style={wrap}>
            {SIZES.map((size) => (
              <GuildIcon key={size} id={GUILD_IDS[0]!} iconUrl={ICON} size={size} />
            ))}
          </div>
          {GUILD_IDS.map((id) => (
            <div key={id} style={wrap}>
              {SIZES.map((size) => (
                <GuildIcon key={size} id={id} size={size} />
              ))}
            </div>
          ))}
        </CardVisual>
      </Card>

      <Card span={6}>
        <h2>BadgeList</h2>
        <CardVisual>
          <BadgeList badges={GUILD_BADGES} />
          <BadgeList badges={USER_BADGES} />
          <BadgeList badges={USER_BADGES} variant="compact" />
          <BadgeList badges={USER_BADGES} variant="compact" max={4} />
          <BadgeList badges={GUILD_BADGES} max={2} />
        </CardVisual>
      </Card>

      <Card span={6}>
        <h2>Statuses and verification</h2>
        <CardVisual>
          <div style={wrap}>
            <PostStatusBadge status="draft" />
            <PostStatusBadge status="published" />
            <PostStatusBadge status="closed" />
            <PostStatusBadge status="hidden" />
            <PostStatusBadge status="published" isExpired />
          </div>
          <div style={wrap}>
            {EXPERIENCES.map((experience) => (
              <VerificationPill key={experience.id} verification={experience.verification} />
            ))}
          </div>
          <div style={wrap}>
            <RelativeTime value={FIVE_MINUTES_AGO} />
            <RelativeTime value={hoursAgo(30)} />
            <RelativeTime value="2026-03-12T10:00:00+00:00" />
            <ExpiryLabel expiresAt={inDays(5)} isExpired={false} />
            <ExpiryLabel expiresAt={null} isExpired={false} mode="always" />
            <ExpiryLabel expiresAt={inDays(60)} isExpired={false} mode="always" />
            <ExpiryLabel expiresAt={null} isExpired />
          </div>
          <StaleNotice />
        </CardVisual>
      </Card>

      <Stack span={8}>
        <Card>
          <h2>PostCard, feed variant</h2>
          <p>A list of whole-card links, each in an li. Long titles and descriptions are clamped.</p>
        </Card>
        <ul style={list}>
          {[POST_GUILD, POST_USER, POST_LONG, ...POST_STATUSES.slice(0, 1)].map((post) => (
            <li key={post.id}>
              <PostCard post={post} showStatus={post.status !== 'published'} />
            </li>
          ))}
        </ul>
      </Stack>

      <Stack span={4}>
        <Section title="PostCard, row variant">
          <Rows as="ul">
            {[POST_GUILD, POST_USER, ...POST_STATUSES].map((post) => (
              <PostCard key={post.id} post={post} variant="row" showStatus />
            ))}
          </Rows>
        </Section>
        <Section title="ApplicationAction">
          <div style={column}>
            <ApplicationAction
              post={{
                ...POST_GUILD,
                application: {type: 'external_url', url: 'https://forms.example.com/modo'},
              }}
            />
            <ApplicationAction post={{...POST_GUILD, application: {type: 'discord_dm', url: null}}} />
            <p className="text-muted text-small">Expired, closed or without application: nothing below.</p>
            <ApplicationAction post={{...POST_GUILD, is_expired: true, application: {type: 'discord_dm', url: null}}} />
            <ApplicationAction post={{...POST_GUILD, application: null}} />
          </div>
        </Section>
      </Stack>

      <Block span={6} title="RequirementList">
        <RequirementList requirements={REQUIREMENTS} />
      </Block>

      <Block span={6} title="RequirementList, with a viewer">
        <RequirementList requirements={REQUIREMENTS.slice(0, 4)} viewer={VIEWER} />
      </Block>

      <Block span={6} title="Commitment, languages, time zone, links">
        <div style={column}>
          <CommitmentSummary commitment={POST_GUILD.commitment} />
          <CommitmentSummary commitment={{hours_per_week: null, compensation: 'paid', openings: 1}} />
          <LanguageList codes={['fr', 'en', 'es', 'de', 'pt']} />
          <LanguageList codes={['fr', 'en', 'es', 'de', 'pt']} variant="inline" max={3} />
          <TimezoneLabel timezone="Europe/Paris" />
          <TimezoneLabel timezone="UTC+02:00" />
          <TimezoneLabel timezone="America/New_York" />
          <TimezoneLabel timezone="UTC-05:30" />
          <TimezoneLabel timezone="Mars/Olympus" />
          <Chips>
            <Chip icon="translate">Chips for comparison</Chip>
          </Chips>
        </div>
        <LinkList links={LINKS} />
      </Block>

      <Block span={6} title="ExperienceRow">
        <Rows as="ul">
          {EXPERIENCES.map((experience, index) => (
            <ExperienceRow
              key={experience.id}
              experience={experience}
              href={experience.kind === 'guild' ? `/guilds/${experience.guild_id}` : undefined}
              iconUrl={index === 1 ? ICON : undefined}
              actions={
                index === 0 ? (
                  <>
                    <md-outlined-button>Edit</md-outlined-button>
                    <md-outlined-button>Delete</md-outlined-button>
                  </>
                ) : undefined
              }
            />
          ))}
        </Rows>
      </Block>

      <Block span={6} title="ReportDialog, NsfwGate">
        <div style={column}>
          <div style={wrap}>
            <ReportButton target={{type: 'post', id: POST_GUILD.id}} />
            <md-outlined-button onclick={() => setReport(true)}>Open the dialog directly</md-outlined-button>
          </div>
          <ReportDialog open={report} onClose={() => setReport(false)} target={{type: 'guild', id: GUILD_IDS[0]!}} />
          <div style={wrap}>
            <md-outlined-button onclick={resetNsfwConfirmed}>Forget the age confirmation</md-outlined-button>
            <md-outlined-button onclick={() => setConfirmDialog(true)}>Open the feed confirmation</md-outlined-button>
          </div>
          <NsfwConfirmDialog
            open={confirmDialog}
            onCancel={() => setConfirmDialog(false)}
            onConfirmed={() => setConfirmDialog(false)}
          />
        </div>
      </Block>

      <Stack span={6}>
        <NsfwGate nsfw>
          <Card>
            <h2>Adult content (confirmed)</h2>
            <p>The content behind the gate.</p>
          </Card>
        </NsfwGate>
      </Stack>

      <Stack span={6}>
        <Section title="Quota, invitation">
          <div style={column}>
            <QuotaMeter used={2} limit={5} scope="guild" />
            <QuotaMeter used={5} limit={5} scope="guild" />
            <QuotaMeter used={1} limit={3} scope="user" />
          </div>
          <InviteHelp />
        </Section>
      </Stack>

      <EmptyState icon="inbox" title="No post yet" action={<LinkButton to="/posts/new">Write a post</LinkButton>}>
        Published posts of this server appear here.
      </EmptyState>

      <Block span={6} title="EmptyState, compact">
        <EmptyState
          compact
          icon="work_history"
          title="No experience yet"
          action={<md-outlined-button>Add</md-outlined-button>}
        >
          Add the servers you helped run.
        </EmptyState>
      </Block>

      <Block span={6} title="ErrorState, compact and RetryButton">
        <div style={column}>
          <ErrorState compact error={limited} onRetry={() => {}} />
          <ErrorState compact error={missing} onRetry={() => {}} />
          <RetryButton onRetry={() => {}} error={unavailable} />
        </div>
      </Block>

      <ErrorState error={offline} onRetry={() => {}} />
      <ErrorState error={missing} />

      <Card>
        <CardActions>
          <md-text-button onclick={() => window.scrollTo({top: 0})}>Back to top</md-text-button>
        </CardActions>
      </Card>
    </>
  );
}
