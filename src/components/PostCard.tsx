/**
 * A post in two forms.
 *
 *  - `feed`: a whole-card link (`a.card`, the kit's one hover). Nothing
 *    interactive inside it. Server or author (with the verification mark) and
 *    the date, title, a two-line excerpt, then one line of meta (positions as
 *    small pills, compensation, hours, openings, expiry, language flags). The
 *    page says whether servers recruit or people offer: no kind marker.
 *    Put each card in an `<li>` of a `<ul>` on the page.
 *  - `row`: an inner card (`a`) for lists inside a profile or "my posts"; goes in
 *    `<InnerCards>`. With `showStatus`, the post's status on the right.
 */

import {useCatalogLabel} from '@/api/catalog';
import type {Post} from '@/api/types';
import {paths} from '@/app/paths';
import {useT} from '@/i18n/useT';
import {Card, Icon, InnerCard, RowBody, Shape} from '@/ui';

import {CommitmentSummary} from './CommitmentSummary';
import {ExpiryLabel} from './ExpiryLabel';
import {expiryIsNear} from './expiry';
import {DisplayName} from './DisplayName';
import {GuildIcon} from './GuildIcon';
import {LanguageFlags} from './LanguageFlags';
import {positionIcon, positionItems} from './positions';
import {PostStatusBadge} from './PostStatusBadge';
import {RelativeTime} from './RelativeTime';
import {plainExcerpt} from './text';
import {UserAvatar} from './UserAvatar';

interface PostCardProps {
  post: Post;
  variant?: 'feed' | 'row';
  /** Show the status pill (draft, published…): "my posts" and the staff. */
  showStatus?: boolean;
}

export function PostCard({post, variant = 'feed', showStatus}: PostCardProps) {
  return variant === 'row' ? (
    <PostRow post={post} showStatus={showStatus} />
  ) : (
    <PostFeedCard post={post} showStatus={showStatus} />
  );
}

function usePositionItems(post: Post) {
  const {label} = useCatalogLabel();
  return positionItems(post.positions, post.positions_other, (id) => label('positions', id));
}

function PostFeedCard({post, showStatus}: {post: Post; showStatus?: boolean}) {
  const {t} = useT('components');
  const positions = usePositionItems(post);
  const isGuild = post.kind === 'guild';
  const name = isGuild
    ? (post.guild?.name ?? t('post.unknownGuild'))
    : (post.author.global_name ?? post.author.username ?? t('post.unknownAuthor'));
  const badges = isGuild ? post.guild?.badges : post.author.badges;
  const near = expiryIsNear(post.expires_at, post.is_expired);
  const hasMeta = positions.length > 0 || post.commitment !== null || post.languages.length > 0 || near;

  return (
    <Card to={paths.post(post.id)} className="post-card">
      <div className="post-head">
        {isGuild && post.guild_id ? (
          <GuildIcon id={post.guild_id} iconUrl={post.guild?.icon_url} size="small" />
        ) : (
          <UserAvatar id={post.author.id} src={post.author.avatar_url} size="small" />
        )}
        <DisplayName
          className="post-author-name"
          name={name}
          badges={badges}
          entity={isGuild ? 'guild' : 'user'}
          focusable={false}
        />
        <RelativeTime className="post-date" value={post.published_at ?? post.created_at} />
        {showStatus && (
          <span className="post-tags">
            <PostStatusBadge status={post.status} isExpired={post.is_expired} />
          </span>
        )}
      </div>

      <h3 className="post-title">{post.title}</h3>
      <p className="post-excerpt">{plainExcerpt(post.description)}</p>

      {hasMeta && (
        <div className="post-meta">
          {positions.length > 0 && (
            <ul className="post-positions" aria-label={t('post.positions')}>
              {positions.map((position) => (
                <li key={position.key} className="post-position">
                  {position.label}
                </li>
              ))}
            </ul>
          )}
          <ul className="meta-list">
            <CommitmentSummary commitment={post.commitment} bare />
            {near && (
              <li className="meta-item expiry-near">
                <Icon name={post.is_expired ? 'event_busy' : 'hourglass_bottom'} />
                <ExpiryLabel expiresAt={post.expires_at} isExpired={post.is_expired} />
              </li>
            )}
          </ul>
          <LanguageFlags codes={post.languages} focusable={false} />
        </div>
      )}
    </Card>
  );
}

function PostRow({post, showStatus}: {post: Post; showStatus?: boolean}) {
  const positions = usePositionItems(post);
  const first = post.positions[0];
  return (
    <InnerCard as="li" to={paths.post(post.id)}>
      <Shape
        small
        shape={post.kind === 'guild' ? 'square' : 'hexagon'}
        tone={post.kind === 'guild' ? 'primary' : 'tertiary'}
        icon={positionIcon(first ?? 'other')}
      />
      <RowBody
        title={post.title}
        meta={
          <>
            {positions.map((position) => position.label).join(', ')}
            {' · '}
            <RelativeTime value={post.published_at ?? post.created_at} />
          </>
        }
      />
      {showStatus && <PostStatusBadge status={post.status} isExpired={post.is_expired} />}
    </InnerCard>
  );
}
