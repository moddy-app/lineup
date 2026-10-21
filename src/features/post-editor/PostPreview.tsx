/** The side column: the post as the feed will show it, built from the form. */

import {useId} from 'react';

import type {Catalog, MeUser, MyGuild, Post} from '@/api/types';
import {PostCard} from '@/components';
import {useT} from '@/i18n/useT';

import {expiryInstant, type FormState, localDay} from './form';

interface PostPreviewProps {
  form: FormState;
  catalog: Catalog;
  guild: MyGuild | undefined;
  base: Post | undefined;
  author: MeUser | undefined;
}

const whole = (text: string): number | null => (/^\d+$/.test(text.trim()) ? Number(text) : null);

export function PostPreview({form, catalog, guild, base, author}: PostPreviewProps) {
  const {t} = useT('editor');
  const headingId = useId();
  const kind = form.kind || 'user';
  const now = new Date();

  const hours = whole(form.hours);
  const openings = whole(form.openings);
  const commitment =
    hours !== null || form.compensation !== '' || openings !== null
      ? {hours_per_week: hours, compensation: form.compensation || null, openings}
      : null;

  const expiresAt =
    form.expiresOn === ''
      ? null
      : base?.expires_at && localDay(new Date(base.expires_at)) === form.expiresOn
        ? base.expires_at
        : expiryInstant(form.expiresOn, now, catalog.limits.post_max_expiry_days);

  const guildId = kind === 'guild' ? form.guildId || null : null;
  const preview: Post = {
    id: base?.id ?? 'preview',
    kind,
    guild_id: guildId,
    author_id: author?.id ?? base?.author_id ?? '0',
    title: form.title.trim() || t('preview.titlePlaceholder'),
    description: form.description.trim() || t('preview.descriptionPlaceholder'),
    positions: form.positions,
    positions_other: form.positions.includes('other') ? form.positionsOther.filter((label) => label.trim() !== '') : [],
    requirements: [],
    application: null,
    languages: form.languages,
    timezone: form.timezone || null,
    commitment,
    theme: form.theme || null,
    tags: form.tags,
    featured_experience_id: null,
    status: base?.status ?? 'draft',
    expires_at: expiresAt,
    published_at: base?.published_at ?? null,
    created_at: base?.created_at ?? now.toISOString(),
    updated_at: now.toISOString(),
    is_expired: false,
    guild: guildId ? {id: guildId, name: guild?.name ?? base?.guild?.name ?? null, icon_url: guild?.icon_url ?? base?.guild?.icon_url ?? null} : null,
    author: {
      id: author?.id ?? '0',
      username: author?.username ?? null,
      global_name: author?.global_name ?? null,
      avatar_url: author?.avatar_url ?? null,
    },
  };

  return (
    <section className="ed-preview" aria-labelledby={headingId}>
      <h2 id={headingId}>{t('preview.title')}</h2>
      <p>{t('preview.hint')}</p>
      {/* A picture of the card: not a link to follow while writing. */}
      <div className="ed-preview-card" inert>
        <PostCard post={preview} />
      </div>
    </section>
  );
}
