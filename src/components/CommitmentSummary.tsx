/**
 * What a post asks for in time and what it offers: compensation, hours per
 * week, number of openings. Nothing when the author left all three empty.
 */

import {useCatalogLabel} from '@/api/catalog';
import type {Commitment} from '@/api/types';
import {useT} from '@/i18n/useT';
import {formatNumber} from '@/lib/format';
import {Icon} from '@/ui';

interface CommitmentSummaryProps {
  commitment: Commitment | null | undefined;
  /** Only the list items, for a parent that lays out its own `<ul class="meta-list">`. */
  bare?: boolean;
}

function MetaItem({icon, children}: {icon: string; children: string}) {
  return (
    <li className="meta-item">
      <Icon name={icon} />
      <span>{children}</span>
    </li>
  );
}

export function CommitmentSummary({commitment, bare}: CommitmentSummaryProps) {
  const {t} = useT('components');
  const {label} = useCatalogLabel();
  if (!commitment) return null;

  const {compensation, hours_per_week: hours, openings} = commitment;
  const items = [
    compensation && (
      <MetaItem key="compensation" icon="payments">
        {label('compensations', compensation)}
      </MetaItem>
    ),
    hours != null && (
      <MetaItem key="hours" icon="schedule">
        {t('post.hoursPerWeek', {value: formatNumber(hours)})}
      </MetaItem>
    ),
    openings != null && (
      <MetaItem key="openings" icon="group_add">
        {t('post.openings', {count: openings, value: formatNumber(openings)})}
      </MetaItem>
    ),
  ].filter(Boolean);

  if (items.length === 0) return null;
  return bare ? <>{items}</> : <ul className="meta-list">{items}</ul>;
}
