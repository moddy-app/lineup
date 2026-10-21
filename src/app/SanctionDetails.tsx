import type {SanctionInfo} from '@/api/types';
import {useLanguage} from '@/i18n/useLanguage';
import {useT} from '@/i18n/useT';
import {formatDate} from '@/lib/format';
import {Pill} from '@/ui';

/** What the person needs to quote or know about their sanction: its references, and when it ends. */
export function SanctionDetails({sanction}: {sanction: SanctionInfo}) {
  const {t} = useT('common');
  useLanguage();
  return (
    <div className="sanction-details">
      {sanction.references.length > 0 && (
        <p className="sanction-references">
          <span>{t('suspended.references')}</span>
          {sanction.references.map((reference) => (
            <Pill key={reference}>{reference}</Pill>
          ))}
        </p>
      )}
      <p>
        {sanction.expires_at
          ? t('suspended.until', {date: formatDate(sanction.expires_at, 'long')})
          : t('suspended.noEnd')}
      </p>
    </div>
  );
}
