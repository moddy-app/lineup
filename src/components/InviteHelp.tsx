/**
 * How to create the permanent invitation Lineup asks for (LINEUP.md §3): a
 * link that never expires. A short ordered list, for the claim form and the
 * experience form.
 */

import {useT} from '@/i18n/useT';

interface InviteHelpProps {
  headingLevel?: 2 | 3 | 4;
  className?: string;
}

export function InviteHelp({headingLevel = 3, className}: InviteHelpProps) {
  const {t} = useT('components');
  const Heading = `h${headingLevel}` as const;
  return (
    <div className={className ? `invite-help ${className}` : 'invite-help'}>
      <Heading>{t('invite.title')}</Heading>
      <p>{t('invite.intro')}</p>
      <ol className="invite-steps">
        <li>{t('invite.steps.open')}</li>
        <li>{t('invite.steps.expire')}</li>
        <li>{t('invite.steps.uses')}</li>
        <li>{t('invite.steps.copy')}</li>
      </ol>
    </div>
  );
}
