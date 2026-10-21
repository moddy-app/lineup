import {setLanguage} from '@/i18n';
import {LANGUAGES, type Language} from '@/i18n/languages';
import {useLanguage} from '@/i18n/useLanguage';
import {useT} from '@/i18n/useT';
import {Dropdown} from '@/ui';

/**
 * The language selector of the app bar: an icon button that opens a menu of
 * the five languages, each in its own name, the current one with a check.
 */
export function LanguageMenu() {
  const {t} = useT('common');
  const language = useLanguage();

  const choose = (code: Language) => {
    if (code !== language) void setLanguage(code);
  };

  return (
    <span className="language-menu">
      <Dropdown
        align="end"
        label={t('language.label')}
        items={LANGUAGES.map(({code, name}) => ({
          key: code,
          label: name,
          lang: code,
          selected: code === language,
          onSelect: () => choose(code),
        }))}
        trigger={({ref, onActivate, ...aria}) => (
          <md-icon-button
            ref={ref}
            aria-label={t('language.label')}
            title={t('language.label')}
            onclick={onActivate}
            {...aria}
          >
            <md-icon>translate</md-icon>
          </md-icon-button>
        )}
      />
    </span>
  );
}
