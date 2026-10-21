/**
 * Languages by name (from the catalog), as chips for a profile or as a short
 * line ("Français, Anglais +2") for a card.
 */

import {useCatalogLabel} from '@/api/catalog';
import {useT} from '@/i18n/useT';
import {formatNumber} from '@/lib/format';
import {Chip, Chips} from '@/ui';

interface LanguageListProps {
  /** Catalog language ids. */
  codes: readonly string[];
  variant?: 'chips' | 'inline';
  /** Show this many, then "+n". */
  max?: number;
  className?: string;
}

export function LanguageList({codes, variant = 'chips', max, className}: LanguageListProps) {
  const {t} = useT('components');
  const {label} = useCatalogLabel();
  if (codes.length === 0) return null;

  const names = codes.map((code) => label('languages', code));
  const shown = max !== undefined ? names.slice(0, max) : names;
  const rest = names.length - shown.length;

  if (variant === 'inline') {
    return (
      <span className={className} title={rest > 0 ? names.join(', ') : undefined}>
        {shown.join(', ')}
        {rest > 0 && <span className="numeric"> {t('languages.more', {count: rest, value: formatNumber(rest)})}</span>}
      </span>
    );
  }
  return (
    <Chips className={className} role="list" aria-label={t('languages.label')}>
      {shown.map((name, index) => (
        <Chip key={codes[index]} icon="translate" role="listitem">
          <span className="chip-label">{name}</span>
        </Chip>
      ))}
      {rest > 0 && (
        <Chip title={names.join(', ')} role="listitem">
          <span className="numeric">{t('languages.more', {count: rest, value: formatNumber(rest)})}</span>
        </Chip>
      )}
    </Chips>
  );
}
