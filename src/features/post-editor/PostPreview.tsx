/** The post's text as it will read: its title and its Markdown description. */

import {Markdown} from '@/components';
import {useT} from '@/i18n/useT';

interface PostPreviewProps {
  title: string;
  description: string;
}

export function PostPreview({title, description}: PostPreviewProps) {
  const {t} = useT('editor');
  const trimmedTitle = title.trim();
  const trimmedDescription = description.trim();
  return (
    <section className="ed-preview" aria-label={t('preview.title')}>
      <p className="ed-preview-label">{t('preview.title')}</p>
      <h3 className={trimmedTitle ? undefined : 'is-placeholder'}>{trimmedTitle || t('preview.titlePlaceholder')}</h3>
      {trimmedDescription ? (
        <Markdown>{trimmedDescription}</Markdown>
      ) : (
        <p className="is-placeholder">{t('preview.descriptionPlaceholder')}</p>
      )}
    </section>
  );
}
