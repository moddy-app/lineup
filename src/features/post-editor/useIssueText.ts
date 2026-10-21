import {useT} from '@/i18n/useT';

import type {Issue} from './form';

/** Translates a client issue (a key of `editor:validation` and its numbers). */
export function useIssueText(): (issue: Issue) => string {
  const {t} = useT('editor');
  return (issue) => t(`validation.${issue.message}` as 'validation.required', issue.params);
}
