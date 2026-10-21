import {formatNumber} from '@/lib/format';
import {useLanguage} from '@/i18n/useLanguage';

interface StatProps {
  /** A number is formatted in the page language (12 345 / 12,345). */
  value: number | string;
  label: string;
}

/** A figure with its label, in tabular numerals. */
export function Stat({value, label}: StatProps) {
  useLanguage(); // Render again when the language (and so the number format) changes.
  return (
    <div className="stat">
      <span className="stat-value">{typeof value === 'number' ? formatNumber(value) : value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}
