/**
 * When a post expires. In `soon` mode (a card) it only speaks when the end is
 * near (within 14 days) or past, and is empty otherwise; in `always` mode (the
 * post page) it also gives the date, or says there is none.
 */

import {useLanguage} from '@/i18n/useLanguage';
import {useT} from '@/i18n/useT';
import {formatDate} from '@/lib/format';

import {expiryInfo} from './expiry';
import {useNow} from './useNow';

interface ExpiryLabelProps {
  expiresAt: string | null;
  isExpired: boolean;
  mode?: 'soon' | 'always';
  className?: string;
}

export function ExpiryLabel({expiresAt, isExpired, mode = 'soon', className}: ExpiryLabelProps) {
  const {t} = useT('components');
  useLanguage();
  const now = useNow();
  const info = expiryInfo(expiresAt, isExpired, now);

  let text: string | null = null;
  switch (info.kind) {
    case 'expired':
      text = t('expiry.expired');
      break;
    case 'hours':
      text = t('expiry.inHours', {count: info.value, value: info.value});
      break;
    case 'days':
      text = t('expiry.inDays', {count: info.value, value: info.value});
      break;
    case 'later':
      text = mode === 'always' ? t('expiry.on', {date: formatDate(info.date, 'long')}) : null;
      break;
    case 'never':
      text = mode === 'always' ? t('expiry.never') : null;
      break;
  }
  return text ? <span className={className}>{text}</span> : null;
}
