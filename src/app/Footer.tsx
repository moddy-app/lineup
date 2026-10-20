import {Trans} from 'react-i18next';

import {setLanguage} from '@/i18n';
import {LANGUAGES, type Language, resolveLanguage} from '@/i18n/languages';
import {useLanguage} from '@/i18n/useLanguage';
import {useT} from '@/i18n/useT';
import {Select} from '@/ui';

const LANGUAGE_OPTIONS = LANGUAGES.map(({code, name}) => ({value: code, label: name}));

/** The footer card: who makes Lineup, and the language selector. */
export function Footer() {
  const {t} = useT('common');
  const language = useLanguage();

  return (
    <footer className="app-footer">
      <div className="app-footer-card">
        <div className="app-footer-row">
          <p className="app-footer-byline">
            <Trans
              t={t}
              i18nKey="footer.byline"
              components={{moddy: <a href="https://moddy.app" target="_blank" rel="noopener" />}}
            />
          </p>
          <Select
            className="language-select"
            label={t('footer.language')}
            value={language}
            options={LANGUAGE_OPTIONS}
            onValueChange={(value) => {
              const next: Language | null = resolveLanguage(value);
              if (next) void setLanguage(next);
            }}
          />
        </div>
      </div>
    </footer>
  );
}
