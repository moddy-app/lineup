/**
 * A post in two forms.
 *
 *  - `feed`: a whole-card link (`a.card`, the kit's one hover). Nothing
 *    interactive inside it. Server or author, kind, title, excerpt, positions,
 *    then one line of meta (compensation, hours, openings, languages, expiry).
 *    Put each card in an `<li>` of a `<ul>` on the page.
 *  - `row`: an `a.row` for lists inside a profile or "my posts"; goes in
 *    `<Rows as="ul">`. With `showStatus`, the post's status on the right.
 */

import {useCatalogLabel} from '@/api/catalog';
import type {Post} from '@/api/types';
import {paths} from '@/app/paths';
import {useT} from '@/i18n/useT';
import {Card, Chip, Chips, Icon, Row, RowBody, Shape, Status} from '@/ui';

import {CommitmentSummary} from './CommitmentSummary';
import {ExpiryLabel} from './ExpiryLabel';
import {expiryIsNear} from './expiry';
import {GuildIcon} from './GuildIcon';
import {LanguageList} from './LanguageList';
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

/** The first LANGUAGE_MAX languages in a card, then "+n". */
const LANGUAGE_MAX = 3;

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
  const near = expiryIsNear(post.expires_at, post.is_expired);
  const hasMeta = post.commitment !== null || post.languages.length > 0 || near;

  return (
    <Card to={paths.post(post.id)} className="post-card">
      <div className="post-head">
        {isGuild && post.guild_id ? (
          <GuildIcon id={post.guild_id} iconUrl={post.guild?.icon_url} />
        ) : (
          <UserAvatar id={post.author.id} src={post.author.avatar_url} />
        )}
        <div className="row-body">
          <span className="row-title">
            <strong>{name}</strong>
          </span>
          <span className="row-meta">
            <RelativeTime value={post.published_at ?? post.created_at} />
          </span>
        </div>
        <div className="post-tags">
          <Status variant={isGuild ? 'default' : 'strong'}>{t(`post.kind.${post.kind}`)}</Status>
          {showStatus && <PostStatusBadge status={post.status} isExpired={post.is_expired} />}
        </div>
      </div>

      <h2 className="post-title">{post.title}</h2>
      <p className="post-excerpt">{plainExcerpt(post.description)}</p>

      {positions.length > 0 && (
        <Chips aria-label={t('post.positions')}>
          {positions.map((position) => (
            <Chip key={position.key} icon={position.icon}>
              <span className="chip-label">{position.label}</span>
            </Chip>
          ))}
        </Chips>
      )}

      {hasMeta && (
        <ul className="meta-list">
          <CommitmentSummary commitment={post.commitment} bare />
          {post.languages.length > 0 && (
            <li className="meta-item">
              <Icon name="translate" />
              <LanguageList codes={post.languages} variant="inline" max={LANGUAGE_MAX} />
            </li>
          )}
          {near && (
            <li className="meta-item expiry-near">
              <Icon name={post.is_expired ? 'event_busy' : 'hourglass_bottom'} />
              <ExpiryLabel expiresAt={post.expires_at} isExpired={post.is_expired} />
            </li>
          )}
        </ul>
      )}
    </Card>
  );
}

function PostRow({post, showStatus}: {post: Post; showStatus?: boolean}) {
  const positions = usePositionItems(post);
  const first = post.positions[0];
  return (
    <Row to={paths.post(post.id)}>
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
    </Row>
  );
}
