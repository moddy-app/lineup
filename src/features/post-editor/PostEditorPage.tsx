import {useParams} from 'react-router';

import {PagePlaceholder} from '@/app/PagePlaceholder';
import {usePageTitle} from '@/app/usePageTitle';
import {useT} from '@/i18n/useT';

/** Placeholder for /posts/new and /posts/:postId/edit: the title tells which. */
export function Component() {
  const {t} = useT('editor');
  const {postId} = useParams();
  const title = postId ? t('titleEdit') : t('titleNew');
  usePageTitle(title);
  return <PagePlaceholder title={title} />;
}
