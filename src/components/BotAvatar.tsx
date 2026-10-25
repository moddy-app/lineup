/**
 * A bot's picture: round like the account it is on Discord. Without one (or
 * when it fails to load), a hexagon with `smart_toy`, so a bot is never drawn
 * with a person's default avatar. Same sizes as `GuildIcon`.
 */

import {useState} from 'react';

import {cx} from '@/lib/cx';
import {type AvatarSize, Shape} from '@/ui';

import {guildTone} from './guildTone';

interface BotAvatarProps {
  /** The bot's id: picks the tone of the placeholder. */
  id: string;
  src?: string | null;
  size?: AvatarSize;
  className?: string;
}

export function BotAvatar({id, src, size = 'default', className}: BotAvatarProps) {
  const [failed, setFailed] = useState<string | null>(null);
  const classes = cx('guild-icon', 'bot-avatar', size !== 'default' && `is-${size}`, className);
  if (src && src !== failed) {
    return <img className={classes} src={src} alt="" loading="lazy" decoding="async" onError={() => setFailed(src)} />;
  }
  return <Shape shape="hexagon" tone={guildTone(id)} icon="smart_toy" className={classes} />;
}
