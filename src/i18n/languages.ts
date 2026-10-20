/** The five languages of Lineup, each named in its own language. */
export const LANGUAGES = [
  {code: 'en', name: 'English'},
  {code: 'fr', name: 'Français'},
  {code: 'es', name: 'Español'},
  {code: 'pt-BR', name: 'Português (Brasil)'},
  {code: 'de', name: 'Deutsch'},
] as const;

export type Language = (typeof LANGUAGES)[number]['code'];

export const LANGUAGE_CODES: readonly Language[] = LANGUAGES.map((language) => language.code);

export const FALLBACK_LANGUAGE: Language = 'en';

/** localStorage key for the language the person picked. */
export const LANGUAGE_STORAGE_KEY = 'lineup-lang';

/**
 * Maps any BCP 47 tag ("fr-CA", "pt-PT", "de_AT", "EN") to one of the five
 * languages, or null when Lineup has no translation for it.
 */
export function resolveLanguage(tag: string | null | undefined): Language | null {
  if (!tag) return null;
  const primary = tag.trim().toLowerCase().split(/[-_]/)[0];
  switch (primary) {
    case 'en':
      return 'en';
    case 'fr':
      return 'fr';
    case 'es':
      return 'es';
    case 'pt':
      return 'pt-BR';
    case 'de':
      return 'de';
    default:
      return null;
  }
}
