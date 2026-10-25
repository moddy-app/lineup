/**
 * Who recruits with a post: `post.guild` for a server post, `post.bot` for a
 * bot post, `post.author` for a personal one. One place decides the name,
 * the picture, the badges and the profile to link to.
 */

import type {Badge, Post} from '@/api/types';
import {paths} from '@/app/paths';

import type {ComponentsT} from './componentsT';
import type {VerificationEntity} from './verification';

export interface Recruiter {
  entity: VerificationEntity;
  id: string;
  name: string;
  imageUrl: string | null;
  badges: readonly Badge[] | undefined;
  /** The public profile. */
  to: string;
}

export function recruiterOf(post: Post, t: ComponentsT): Recruiter {
  if (post.kind === 'bot' && post.bot_id) {
    return {
      entity: 'bot',
      id: post.bot_id,
      name: post.bot?.name ?? t('post.unknownBot'),
      imageUrl: post.bot?.avatar_url ?? null,
      badges: post.bot?.badges,
      to: paths.bot(post.bot_id),
    };
  }
  if (post.kind === 'guild' && post.guild_id) {
    return {
      entity: 'guild',
      id: post.guild_id,
      name: post.guild?.name ?? t('post.unknownGuild'),
      imageUrl: post.guild?.icon_url ?? null,
      badges: post.guild?.badges,
      to: paths.guild(post.guild_id),
    };
  }
  return {
    entity: 'user',
    id: post.author.id,
    name: post.author.global_name ?? post.author.username ?? t('post.unknownAuthor'),
    imageUrl: post.author.avatar_url,
    badges: post.author.badges,
    to: paths.user(post.author_id),
  };
}
