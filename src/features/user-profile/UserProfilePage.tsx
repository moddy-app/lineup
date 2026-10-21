/**
 * A person's public profile (LINEUP.md §6.3, §9), a showcase page: banner,
 * header (avatar, name with its verification mark, handle, headline, a line of
 * facts), then the presentation, the experiences as a timeline and the posts
 * on the left, the links on the right. Oneself and the staff get the private
 * view of the experiences (pending, refused).
 */

import {useParams} from 'react-router';

import {isApiError} from '@/api/client';
import {useUser} from '@/api/queries';
import type {UserProfile} from '@/api/types';
import {paths} from '@/app/paths';
import {usePageTitle} from '@/app/usePageTitle';
import {
  BadgeStrip,
  DisplayName,
  Fact,
  FactList,
  EmptyState,
  ErrorState,
  LanguageFlags,
  LinkList,
  Markdown,
  PostCard,
  StaleNotice,
  TimezoneLabel,
  UserAvatar,
} from '@/components';
import {ExperienceList, ExperienceRow} from '@/components/ExperienceRow';
import {useLanguage} from '@/i18n/useLanguage';
import {useT} from '@/i18n/useT';
import {formatMonthYear} from '@/lib/format';
import {Card, Icon, LinkButton, PageHeader, InnerCards, PageLoading, ShowcasePage, Status} from '@/ui';

import {ProfileMenu} from './ProfileMenu';
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
      <ShowcasePage>
        {notFound ? (
          <EmptyState
            icon="person_search"
            title={t('notFound.title')}
            shape="hexagon"
            tone="tertiary"
            action={
              <LinkButton to={paths.feed()} variant="outlined">
                {t('notFound.action')}
              </LinkButton>
            }
          >
            {t('notFound.body')}
          </EmptyState>
        ) : (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} retrying={query.isFetching} />
        )}
      </ShowcasePage>
    );
  }
  return <Profile profile={query.data} />;
}

function Profile({profile}: {profile: UserProfile}) {
  const {t} = useT('userProfile');
  useLanguage();
  const name = profile.display_name ?? profile.username ?? profile.id;
  const hasLinks = profile.links.length > 0;

  return (
    <ShowcasePage className="profile-page">
      <Card as="article" className="profile-head-card">
        {profile.banner_url && (
          <div className="profile-banner">
            <img src={profile.banner_url} alt="" decoding="async" />
          </div>
        )}
        <PageHeader
          className="profile-header"
          leading={
            <UserAvatar id={profile.id} src={profile.avatar_url} decoration={profile.avatar_decoration} size="xl" />
          }
          title={<DisplayName name={name} badges={profile.badges} entity="user" />}
          subtitle={profile.username ? `@${profile.username}` : undefined}
          meta={
            <>
              {profile.headline && <p className="profile-headline">{profile.headline}</p>}
              <div className="profile-meta-line">
                {profile.open_to_work && (
                  <Status variant="accent" className="with-icon">
                    <Icon name="work" filled />
                    {t('header.openToWork')}
                  </Status>
                )}
                <BadgeStrip badges={profile.badges} />
              </div>
            </>
          }
          actions={
            <>
              {profile.is_self && (
                <LinkButton to={paths.me()} variant="outlined" icon="edit">
                  {t('header.edit')}
                </LinkButton>
              )}
              <ProfileMenu userId={profile.id} isSelf={profile.is_self} />
            </>
          }
        />
      </Card>

      {profile.stale && <StaleNotice />}

      <div className="profile-columns">
        <div className="profile-main">
          {(profile.bio || profile.is_self) && (
            <Card as="section" className="profile-card" aria-labelledby="profile-bio">
              <h2 id="profile-bio">{t('bio.title')}</h2>
              {profile.bio ? <Markdown>{profile.bio}</Markdown> : <p className="profile-empty">{t('bio.emptySelf')}</p>}
            </Card>
          )}

          <Card as="section" className="profile-card" aria-labelledby="profile-experiences">
            <div className="profile-section-head">
              <h2 id="profile-experiences">{t('experiences.title')}</h2>
              {profile.is_self && (
                <LinkButton to={paths.myExperiences()} variant="text" icon="edit">
                  {t('experiences.manage')}
                </LinkButton>
              )}
            </div>
            {profile.experiences.length === 0 ? (
              <p className="profile-empty">{profile.is_self ? t('experiences.emptySelf') : t('experiences.empty')}</p>
            ) : (
              <ExperienceList aria-labelledby="profile-experiences">
                {profile.experiences.map((experience) => (
                  <ExperienceRow
                    key={experience.id}
                    experience={experience}
                    href={
                      experience.kind === 'guild' && experience.guild_id ? paths.guild(experience.guild_id) : undefined
                    }
                  />
                ))}
              </ExperienceList>
            )}
          </Card>

          <Card as="section" className="profile-card" aria-labelledby="profile-posts">
            <h2 id="profile-posts">{t('posts.title')}</h2>
            {profile.posts.length === 0 ? (
              <p className="profile-empty">{profile.is_self ? t('posts.emptySelf') : t('posts.empty')}</p>
            ) : (
              <InnerCards aria-labelledby="profile-posts">
                {profile.posts.map((post) => (
                  <PostCard key={post.id} post={post} variant="row" />
                ))}
              </InnerCards>
            )}
          </Card>
        </div>

        <aside className="profile-side">
          <Card as="section" className="profile-card" aria-labelledby="profile-about">
            <h2 id="profile-about">{t('about.title')}</h2>
            <FactList>
              <Fact icon="calendar_month">{t('header.created', {date: formatMonthYear(profile.created_at)})}</Fact>
              {profile.timezone && (
                <Fact icon="public">
                  <TimezoneLabel timezone={profile.timezone} bare />
                </Fact>
              )}
              {profile.languages.length > 0 && (
                <Fact icon="translate">
                  <LanguageFlags codes={profile.languages} labelled="text" />
                </Fact>
              )}
            </FactList>
          </Card>
          {(hasLinks || profile.is_self) && (
            <Card as="section" className="profile-card" aria-labelledby="profile-links">
              <h2 id="profile-links">{t('links.title')}</h2>
              {hasLinks ? <LinkList links={profile.links} /> : <p className="profile-empty">{t('links.emptySelf')}</p>}
            </Card>
          )}
        </aside>
      </div>
    </ShowcasePage>
  );
}
