/**
 * A person's picture: their Discord avatar, or Discord's default one for their
 * id, and their avatar decoration when they have one. Round (the one round
 * thing in the kit), 32 / 40 / 56 / 96px like the kit's avatars.
 */

import {useState} from 'react';

import type {AvatarDecoration} from '@/api/types';
import {cx} from '@/lib/cx';
import {defaultAvatarUrl} from '@/lib/discord';
import {Avatar, type AvatarSize} from '@/ui';

interface UserAvatarProps {
  /** The Discord id: picks the default avatar when there is no picture. */
  id: string;
  src?: string | null;
  /** Drawn over the picture, 1.2 times its size, as Discord does. */
  decoration?: Pick<AvatarDecoration, 'url'> | null;
  size?: AvatarSize;
  /** Empty by default: the name is almost always written next to the picture. */
  alt?: string;
  className?: string;
}

function fallbackUrl(id: string): string {
  try {
    return defaultAvatarUrl(id);
  } catch {
    return 'https://cdn.discordapp.com/embed/avatars/0.png';
  }
}

export function UserAvatar({id, src, decoration, size = 'default', alt = '', className}: UserAvatarProps) {
  // A picture that fails to load (a deleted avatar) gives way to the default one.
  const [failed, setFailed] = useState<string | null>(null);
  // A decoration that fails to load is hidden, never shown as a broken image.
  const [decorationFailed, setDecorationFailed] = useState<string | null>(null);
  const decorationUrl = decoration?.url && decoration.url !== decorationFailed ? decoration.url : null;
  const url = src && src !== failed ? src : fallbackUrl(id);
  const picture = (
    <Avatar
      src={url}
      size={size}
      alt={alt}
      className={decorationUrl ? undefined : className}
      onError={(event) => {
        if (url === fallbackUrl(id)) event.currentTarget.style.visibility = 'hidden';
        else setFailed(url);
      }}
    />
  );
  if (!decorationUrl) return picture;
  return (
    <span className={cx('user-avatar', size !== 'default' && size, className)}>
      {picture}
      <img
        className="avatar-decoration"
        src={decorationUrl}
        alt=""
        aria-hidden="true"
        onError={() => setDecorationFailed(decorationUrl)}
      />
    </span>
  );
}
