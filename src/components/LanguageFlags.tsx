import {useCatalogLabel} from '@/api/catalog';
import {useT} from '@/i18n/useT';
import {cx} from '@/lib/cx';
import {Icon} from '@/ui';

import {flagUrl} from './languageFlags';
import {tooltipSideProps} from './tooltipSide';

interface LanguageFlagsProps {
  /** Catalog language ids. */
  codes: readonly string[] | undefined | null;
  /** Keyboard focus on each flag, so that its tooltip shows. Off inside a link card. */
  focusable?: boolean;
  /** A line "Languages:" with the translate icon before the flags. Off in very compact lines. */
  labelled?: boolean | 'text';
  className?: string;
}

/**
 * The languages as small flags (4:3, 16 px high), the language name in a
 * tooltip. A language with no flag in the table shows as a text pill.
 */
export function LanguageFlags({codes, focusable = true, labelled, className}: LanguageFlagsProps) {
  const {t} = useT('components');
  const {label} = useCatalogLabel();
  if (!codes || codes.length === 0) return null;

  const list = (
    <ul className={cx('language-flags', !labelled && className)} aria-label={t('languages.label')}>
      {codes.map((code) => {
        const name = label('languages', code);
        const url = flagUrl(code);
        return (
          <li key={code}>
            {url ? (
              <span
                className="language-flag"
                data-tooltip={name}
                aria-label={name}
                role="img"
                tabIndex={focusable ? 0 : undefined}
                {...tooltipSideProps}
              >
                <img src={url} alt="" width={21} height={16} loading="lazy" decoding="async" />
              </span>
            ) : (
              <span className="pill">{name}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
  if (!labelled) return list;
  return (
    <div className={cx('language-line', className)}>
      {labelled !== 'text' && <Icon name="translate" filled />}
      <span className="language-line-label">{t('languages.line', {count: codes.length})}</span>
      {list}
    </div>
  );
}
