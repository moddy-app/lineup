import {PagePlaceholder} from '@/app/PagePlaceholder';
import {usePageTitle} from '@/app/usePageTitle';
import {useT} from '@/i18n/useT';

/** Placeholder: the page's name until its feature is built. */
export function Component() {
  const {t} = useT('staff');
  usePageTitle(t('posts'));
  return <PagePlaceholder title={t('posts')} />;
}
