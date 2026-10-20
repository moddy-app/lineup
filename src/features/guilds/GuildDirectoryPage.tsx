import {PagePlaceholder} from '@/app/PagePlaceholder';
import {usePageTitle} from '@/app/usePageTitle';
import {useT} from '@/i18n/useT';

/** Placeholder: the page's name until its feature is built. */
export function Component() {
  const {t} = useT('guilds');
  usePageTitle(t('title'));
  return <PagePlaceholder title={t('title')} />;
}
