/**
 * A person's public profile (LINEUP.md §6.3, §9). Header, bio, experiences and
 * posts in the main column; links, languages and time zone beside it. Oneself
 * and the staff get the private view of the experiences (pending, rejected).
 */

import {useParams} from 'react-router';

import {isApiError} from '@/api/client';
import {useUser} from '@/api/queries';
import type {UserProfile} from '@/api/types';
import {paths} from '@/app/paths';
import {usePageTitle} from '@/app/usePageTitle';
import {
  BadgeList,
  EmptyState,
  ErrorState,
  ExperienceRow,
  LanguageList,
  LinkList,
  PostCard,
  ReportButton,
  StaleNotice,
  TimezoneLabel,
  UserAvatar,
} from '@/components';
import {useLanguage} from '@/i18n/useLanguage';
import {useT} from '@/i18n/useT';
import {formatDate, formatNumber} from '@/lib/format';
import {
  AppLayout,
  Card,
  CardActions,
  Icon,
  LinkButton,
  PageLoading,
  Pill,
  Rows,
  Section,
  Shape,
  Status,
} from '@/ui';

import './user-profile.css';

export function Component() {
  const {userId} = useParams();
  const {t} = useT('userProfile');
  const query = useUser(userId);
  usePageTitle(query.data?.display_name ?? query.data?.username ?? t('title'));

  if (query.isPending) return <PageLoading />;
  if (query.isError) {
    const notFound = isApiError(query.error) && query.error.status === 404;
    return (
      <AppLayout>
        {notFound ? (
          <EmptyState icon="person_search" title={t('notFound.title')} shape="hexagon" tone="tertiary" action={<LinkButton to={paths.feed()} variant="outlined">{t('notFound.action')}</LinkButton>}>
            {t('notFound.body')}
          </EmptyState>
        ) : (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} retrying={query.isFetching} />
        )}
      </AppLayout>
    );
  }
  return <Profile profile={query.data} />;
}

function Profile({profile}: {profile: UserProfile}) {
  const {t} = useT('userProfile');
  useLanguage();
  const name = profile.display_name ?? profile.username ?? profile.id;
  const hasSide = profile.links.length > 0 || profile.languages.length > 0 || profile.timezone !== null;

  return (
    <AppLayout
      stickyAside
      aside={
        <>
          {hasSide && (
            <Section title={t('about.title')}>
              <div className="profile-facts">
                {profile.timezone && (
                  <div className="profile-fact">
                    <h3>{t('about.timezone')}</h3>
                    <TimezoneLabel timezone={profile.timezone} />
                  </div>
                )}
                {profile.languages.length > 0 && (
                  <div className="profile-fact">
                    <h3>{t('about.languages')}</h3>
                    <LanguageList codes={profile.languages} />
                  </div>
                )}
                {profile.links.length > 0 && (
                  <div className="profile-fact">
                    <h3>{t('about.links')}</h3>
                    <LinkList links={profile.links} />
                  </div>
                )}
              </div>
            </Section>
          )}
          <Card className="profile-account">
            <p className="profile-created">
              <Icon name="calendar_month" />
              {t('header.created', {date: formatDate(profile.created_at, 'long')})}
            </p>
            {profile.is_self ? (
              <CardActions>
                <LinkButton to={paths.me()} variant="outlined" icon="edit">
                  {t('self.edit')}
                </LinkButton>
                <LinkButton to={paths.myExperiences()} variant="outlined" icon="work_history">
                  {t('self.experiences')}
                </LinkButton>
              </CardActions>
            ) : (
              <CardActions>
                <ReportButton target={{type: 'user', id: profile.id}} />
              </CardActions>
            )}
          </Card>
        </>
      }
    >
      <Card as="article" className="profile-header">
        <UserAvatar id={profile.id} src={profile.avatar_url} decoration={profile.avatar_decoration} size="xl" />
        <div className="profile-identity">
          <h1>{name}</h1>
          <div className="profile-handles">
            {profile.username && <Pill>@{profile.username}</Pill>}
            {profile.open_to_work && (
              <Status variant="accent" className="with-icon">
                <Icon name="work" filled />
                {t('header.openToWork')}
              </Status>
            )}
          </div>
          {profile.headline && <p className="profile-headline">{profile.headline}</p>}
          <BadgeList badges={profile.badges} />
          {profile.stale && <StaleNotice />}
        </div>
      </Card>

      {profile.bio && (
        <Section title={t('bio.title')}>
          <p className="profile-bio">{profile.bio}</p>
        </Section>
      )}

      <Section
        title={t('experiences.title')}
        actions={
          profile.is_self && (
            <LinkButton to={paths.myExperiences()} variant="text" icon="edit">
              {t('experiences.manage')}
            </LinkButton>
          )
        }
      >
        {profile.experiences.length === 0 ? (
          <p className="profile-empty">{profile.is_self ? t('experiences.emptySelf') : t('experiences.empty')}</p>
        ) : (
          <Rows as="ul" aria-label={t('experiences.title')}>
            {profile.experiences.map((experience) => (
              <ExperienceRow key={experience.id} experience={experience} />
            ))}
          </Rows>
        )}
      </Section>

      <Section title={t('posts.title')}>
        {profile.posts.length === 0 ? (
          <div className="profile-empty-with-shape">
            <Shape shape="diamond" tone="secondary" icon="campaign" small />
            <p className="profile-empty">{profile.is_self ? t('posts.emptySelf') : t('posts.empty')}</p>
          </div>
        ) : (
          <>
            <p className="profile-count numeric">{t('posts.count', {count: profile.posts.length, value: formatNumber(profile.posts.length)})}</p>
            <Rows as="ul" aria-label={t('posts.title')}>
              {profile.posts.map((post) => (
                <PostCard key={post.id} post={post} variant="row" />
              ))}
            </Rows>
          </>
        )}
      </Section>
    </AppLayout>
  );
}
