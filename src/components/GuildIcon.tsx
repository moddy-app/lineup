/**
 * A server's icon, a rounded square so that a server is never mistaken for a
 * person (avatars are round). Without an icon, a square shape with a
 * `groups` symbol whose tone comes from the server id.
 */

import {useState} from 'react';

import {cx} from '@/lib/cx';
import {type AvatarSize, Shape} from '@/ui';

import {guildTone} from './guildTone';

interface GuildIconProps {
  /** The server's Discord id: picks the tone of the placeholder. */
  id: string;
  iconUrl?: string | null;
  size?: AvatarSize;
  /** The placeholder's symbol (a service, outside Discord, uses another). */
  icon?: string;
  className?: string;
  /** Do not send the page's address to the image's host (an image given by a person). */
  noReferrer?: boolean;
}

export function GuildIcon({id, iconUrl, size = 'default', icon = 'groups', className, noReferrer}: GuildIconProps) {
  const [failed, setFailed] = useState<string | null>(null);
  const classes = cx('guild-icon', size !== 'default' && `is-${size}`, className);

  if (iconUrl && iconUrl !== failed) {
    return (
      <img
        className={classes}
        src={iconUrl}
        alt=""
        loading="lazy"
        decoding="async"
        referrerPolicy={noReferrer ? 'no-referrer' : undefined}
        onError={() => setFailed(iconUrl)}
      />
    );
  }
  return <Shape shape="square" tone={guildTone(id)} icon={icon} className={classes} />;
}
