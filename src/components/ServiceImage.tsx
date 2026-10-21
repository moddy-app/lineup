/**
 * The image of a service experience (an https URL the person typed), or the
 * `apartment` shape when there is none or it does not load. Decorative: the
 * service's name is always next to it. The host never gets the page's address.
 */

import {useState} from 'react';

import {cx} from '@/lib/cx';
import {type AvatarSize, Shape} from '@/ui';

interface ServiceImageProps {
  url: string | null;
  size?: AvatarSize;
  className?: string;
}

const PIXELS: Partial<Record<AvatarSize, number>> = {small: 32, default: 40, large: 56, xl: 72};

export function ServiceImage({url, size = 'default', className}: ServiceImageProps) {
  const [failed, setFailed] = useState<string | null>(null);
  const classes = cx('guild-icon', size !== 'default' && `is-${size}`, className);
  if (url && url !== failed) {
    const pixels = PIXELS[size] ?? 40;
    return (
      <img
        className={cx(classes, 'is-image')}
        src={url}
        alt=""
        width={pixels}
        height={pixels}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailed(url)}
      />
    );
  }
  return <Shape shape="hexagon" tone="secondary" icon="apartment" className={classes} />;
}
