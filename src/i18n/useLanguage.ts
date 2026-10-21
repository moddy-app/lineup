import {useTranslation} from 'react-i18next';

import {FALLBACK_LANGUAGE, type Language, resolveLanguage} from './languages';

/**
 * The current language. Subscribes the component to language changes: use it
 * in anything that formats numbers or dates (the formatters read <html lang>
 * when they run, so the component has to render again on a change).
 */
export function useLanguage(): Language {
  const {i18n} = useTranslation();
  return resolveLanguage(i18n.resolvedLanguage) ?? FALLBACK_LANGUAGE;
}
