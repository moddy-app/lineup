import type {ImgHTMLAttributes} from 'react';

import {cx} from '@/lib/cx';

export type AvatarSize = 'small' | 'default' | 'large' | 'xl';

interface AvatarProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'className' | 'width' | 'height'> {
  src: string;
  size?: AvatarSize;
  className?: string;
}

/**
 * A round picture: 32 (small), 40, 56 (large) or 96px (xl). `alt` is empty
 * by default: the name is almost always written next to the picture, and
 * repeating it would be read twice. Pass an `alt` when the picture stands alone.
 */
export function Avatar({src, size = 'default', alt = '', className, ...props}: AvatarProps) {
  return (
    <img
      loading="lazy"
      decoding="async"
      {...props}
      src={src}
      alt={alt}
      className={cx('avatar', size !== 'default' && size, className)}
    />
  );
}
