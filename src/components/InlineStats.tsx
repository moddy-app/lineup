import {formatCompact, formatNumber} from '@/lib/format';
import {cx} from '@/lib/cx';
import {Icon} from '@/ui';

export interface InlineStat {
  /** Material Symbol name, drawn filled. */
  icon: string;
  /** A number (formatted for the language) or a ready-made string; null or undefined: the item is left out. */
  value: number | string | null | undefined;
  /** What the value counts, already translated ("members"). */
  label: string;
  /** Put the label before the value ("Created February 2021"). */
  labelFirst?: boolean;
}

interface InlineStatsProps {
  items: readonly InlineStat[];
  /** Compact numbers ("12 k") for big counts. Default: full numbers. */
  compact?: boolean;
  className?: string;
}

/** Secondary figures on one line: icon, value in 600, label. For counts that are not the page's subject. */
export function InlineStats({items, compact, className}: InlineStatsProps) {
  const shown = items.filter(
    (item): item is InlineStat & {value: number | string} => item.value !== null && item.value !== undefined,
  );
  if (shown.length === 0) return null;
  return (
    <ul className={cx('inline-stats', className)}>
      {shown.map((item) => (
        <li key={item.label} className="inline-stat">
          <Icon name={item.icon} filled />
          {item.labelFirst && <span className="inline-stat-label">{item.label}</span>}
          <span className="inline-stat-value numeric">
            {typeof item.value === 'number'
              ? compact
                ? formatCompact(item.value)
                : formatNumber(item.value)
              : item.value}
          </span>
          {!item.labelFirst && <span className="inline-stat-label">{item.label}</span>}
        </li>
      ))}
    </ul>
  );
}
