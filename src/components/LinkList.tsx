/**
 * A profile's links: the label the person chose and the host in a mono pill,
 * so the destination is visible before the click. Opens in a new tab with
 * `noopener noreferrer nofollow`. No "external link" icon (kit rule). Only
 * web links are rendered.
 */

import {useT} from '@/i18n/useT';
import type {Link} from '@/api/types';
import {Pill, Shape} from '@/ui';

import {safeLinks} from './links';

export function LinkList({links}: {links: readonly Link[]}) {
  const {t} = useT('components');
  const safe = safeLinks(links);
  if (safe.length === 0) return null;
  return (
    <ul className="rows link-list" aria-label={t('links.label')}>
      {safe.map((link) => (
        <li key={link.url}>
          <a className="row" href={link.url} target="_blank" rel="noopener noreferrer nofollow">
            <Shape shape="square" icon="link" small />
            <span className="row-body">
              <span className="row-title">{link.label}</span>
            </span>
            <Pill>{link.host}</Pill>
          </a>
        </li>
      ))}
    </ul>
  );
}
