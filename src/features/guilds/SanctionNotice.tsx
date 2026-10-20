import type {ApiError} from '@/api/client';
import {errorMessage} from '@/api/errors';
import {useT} from '@/i18n/useT';
import {Icon, Pill} from '@/ui';

/**
 * A `403 guild_suspended`: the server is under a global sanction. The sentence
 * is the central one; the references are what the support asks for.
 */
export function SanctionNotice({error}: {error: ApiError}) {
  const {t: tErrors} = useT('errors');
  const {t: tCommon} = useT('common');
  const sanction = error.sanction;
  return (
    <div className="sanction-notice" role="alert">
      <p>
        <Icon name="gavel" filled />
        {errorMessage(error, tErrors)}
      </p>
      {sanction && sanction.references.length > 0 && (
        <p className="sanction-notice-refs">
          <span>{tCommon('suspended.references')}</span>
          {sanction.references.map((reference) => (
            <Pill key={reference}>{reference}</Pill>
          ))}
        </p>
      )}
      {sanction?.violations_url && (
        <a href={sanction.violations_url} target="_blank" rel="noopener noreferrer">
          {tCommon('suspended.viewSanction')}
        </a>
      )}
    </div>
  );
}
