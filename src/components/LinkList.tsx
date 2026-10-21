/**
 * A profile's links as rows: a small polygon with an icon for the site, the
 * label the person chose, the host under it (so the destination is visible
 * before the click), a chevron. Opens in a new tab with `noopener noreferrer
 * nofollow`. Only web links are rendered.
 */

import type {Link} from '@/api/types';
import {useT} from '@/i18n/useT';
import {Icon, InnerCard, InnerCards, Shape, type ShapeName, type ShapeTone} from '@/ui';

import {safeLinks} from './links';

const SITE_ICONS: Array<[RegExp, string]> = [
  [/(^|\.)discord\.(gg|com)$/, 'forum'],
  [/(^|\.)github\.com$/, 'code'],
  [/(^|\.)(youtube\.com|youtu\.be)$/, 'smart_display'],
  [/(^|\.)instagram\.com$/, 'photo_camera'],
  [/(^|\.)(twitter\.com|x\.com)$/, 'alternate_email'],
];

/** A Material Symbol for the site behind a host; `public` when unknown. */
export function linkIcon(host: string): string {
  return SITE_ICONS.find(([pattern]) => pattern.test(host))?.[1] ?? 'public';
}

const SHAPES: ShapeName[] = ['hexagon', 'pentagon', 'octagon', 'diamond'];
const TONES: ShapeTone[] = ['primary', 'secondary', 'tertiary'];

export function LinkList({links}: {links: readonly Link[]}) {
  const {t} = useT('components');
  const safe = safeLinks(links);
  if (safe.length === 0) return null;
  return (
    <InnerCards className="link-list" aria-label={t('links.label')}>
      {safe.map((link, index) => (
        <InnerCard
          key={link.url}
          as="li"
          className="link-item"
          href={link.url}
          target="_blank"
          rel="noopener noreferrer nofollow"
        >
          <Shape
            small
            shape={SHAPES[index % SHAPES.length]}
            tone={TONES[index % TONES.length]}
            icon={linkIcon(link.host)}
          />
          <span className="link-item-text">
            <span className="link-item-label">{link.label}</span>
            <span className="link-item-host" title={link.host}>
              {link.host}
            </span>
          </span>
          <Icon name="chevron_right" className="link-item-chevron" />
        </InnerCard>
      ))}
    </InnerCards>
  );
}
