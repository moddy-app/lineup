/**
 * "2 / 5 annonces publiées sur ce serveur" with a bar. The bar and the text go
 * to the error color when the quota is full (LINEUP.md §8 "Quotas"; the count is
 * the person's published, unexpired posts).
 */

import {useLanguage} from '@/i18n/useLanguage';
import {useT} from '@/i18n/useT';
import {cx} from '@/lib/cx';
import {formatNumber} from '@/lib/format';
import {Status} from '@/ui';

interface QuotaMeterProps {
  used: number;
  limit: number;
  /** `guild`: posts of a server ("sur ce serveur"); `user`: the person's own. */
  scope: 'guild' | 'user';
  className?: string;
}

export function QuotaMeter({used, limit, scope, className}: QuotaMeterProps) {
  const {t} = useT('components');
  useLanguage();
  const full = used >= limit;
  return (
    <div className={cx('quota-meter', full && 'is-full', className)}>
      <p className="quota-text numeric">
        {t(`quota.${scope}`, {count: limit, used: formatNumber(used), limit: formatNumber(limit)})}
        {full && <Status variant="error">{t('quota.full')}</Status>}
      </p>
      <md-linear-progress value={Math.min(used, limit)} max={Math.max(limit, 1)} aria-hidden="true" />
    </div>
  );
}
