import type {ElementType, ReactNode} from 'react';

import type {Badge} from '@/api/types';
import {cx} from '@/lib/cx';

import {VerifiedBadge} from './VerifiedBadge';
import {type VerificationEntity, verificationOf} from './verification';

interface DisplayNameProps {
  name: ReactNode;
  /** The badges of the server or the person (summaries have them too); none: no mark. */
  badges?: readonly Badge[] | null;
  entity: VerificationEntity;
  /** The element of the container: a heading, `strong`... (`span` by default). */
  as?: ElementType;
  className?: string;
  /** The mark takes keyboard focus (default). Pass false inside a link or a link-card. */
  focusable?: boolean;
}

/**
 * A name, followed by its verification mark when there is one. Use it
 * wherever the name of a server or a person is shown. The name is cut with an
 * ellipsis when the line is short; the mark never shrinks.
 */
export function DisplayName({name, badges, entity, as: Tag = 'span', className, focusable = true}: DisplayNameProps) {
  const kind = verificationOf(badges, entity);
  return (
    <Tag className={cx('display-name', className)}>
      <span className="display-name-text">{name}</span>
      {kind && <VerifiedBadge kind={kind} entity={entity} focusable={focusable} />}
    </Tag>
  );
}
