import i18n from 'i18next';
import {initReactI18next} from 'react-i18next';

import {setString} from '@/lib/storage';

import {detectLanguage} from './detect';
import {FALLBACK_LANGUAGE, type Language, LANGUAGE_STORAGE_KEY, resolveLanguage} from './languages';
import {NAMESPACES, resources} from './resources';

export {LANGUAGES, type Language} from './languages';
export {useT} from './useT';

/** What follows a language change, whoever triggered it. */
function applyLanguage(language: string) {
  document.documentElement.lang = language;
  // The kit's formatters (numbers, dates) read <html lang>, so it must stay right.
  const description = i18n.t('meta.description', {ns: 'common', lng: language});
  document.querySelector('meta[name="description"]')?.setAttribute('content', description);
}

export function initI18n(): typeof i18n {
  if (i18n.isInitialized) return i18n;
  void i18n.use(initReactI18next).init({
    resources,
    lng: detectLanguage(),
    fallbackLng: FALLBACK_LANGUAGE,
    supportedLngs: Object.keys(resources),
    ns: NAMESPACES,
    defaultNS: 'common',
    // Resources are bundled: initialise synchronously, never suspend.
    initAsync: false,
    react: {useSuspense: false},
    interpolation: {escapeValue: false},
    showSupportNotice: false,
  });
  applyLanguage(i18n.resolvedLanguage ?? FALLBACK_LANGUAGE);
  i18n.on('languageChanged', applyLanguage);
  return i18n;
}

/** The language the person picks: applied everywhere and remembered. */
export async function setLanguage(language: Language) {
  setString(LANGUAGE_STORAGE_KEY, language);
  await i18n.changeLanguage(language);
}

/** The current language, always one of the five. */
export function currentLanguage(): Language {
  return resolveLanguage(i18n.resolvedLanguage) ?? FALLBACK_LANGUAGE;
}

export {i18n};
