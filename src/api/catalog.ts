/**
 * Reading the catalog (LINEUP.md §4): looking an entry up, and its label in the
 * current language.
 *
 * The API labels every entry in French and English. The other three languages
 * are translated in the `catalog` namespace by id (es, pt-BR, de): the French
 * and English files there are empty on purpose, the API label is used. An id
 * with no label anywhere (a catalog newer than this build) shows as itself.
 */

import {useCallback} from 'react';

import {useLanguage} from '@/i18n/useLanguage';
import {i18n, type Language} from '@/i18n';

import {useCatalog} from './queries';
import type {Catalog, CatalogEntry, CatalogKind, LocalizedLabel} from './types';

export const CATALOG_KINDS = [
  'positions',
  'requirements',
  'application_types',
  'themes',
  'languages',
  'compensations',
  'badges',
] as const satisfies readonly CatalogKind[];

/** The entry with this id in one list of the catalog, if the catalog is loaded and has it. */
export function catalogLookup<K extends CatalogKind>(
  catalog: Catalog | undefined,
  kind: K,
  id: string,
): Catalog[K][number] | undefined {
  return (catalog?.[kind] as ReadonlyArray<CatalogEntry> | undefined)?.find((entry) => entry.id === id) as
    Catalog[K][number] | undefined;
}

/**
 * The text of a label. French and English come from the API's `label`; the
 * others from `translated` (the `catalog` namespace) and fall back to English.
 * Without any label, the id.
 */
export function pickCatalogLabel(options: {
  language: Language;
  id: string;
  label: LocalizedLabel | undefined;
  translated: string | undefined;
}): string {
  const {language, id, label, translated} = options;
  if (language === 'fr') return label?.fr ?? id;
  if (language === 'en') return label?.en ?? id;
  return translated ?? label?.en ?? id;
}

/** The translation of an entry in the current non-French, non-English language, if there is one. */
function translation(language: Language, kind: CatalogKind, id: string): string | undefined {
  if (language === 'fr' || language === 'en') return undefined;
  const value = i18n.getResource(language, 'catalog', `${kind}.${id}`) as unknown;
  return typeof value === 'string' && value !== '' ? value : undefined;
}

export interface CatalogLabels {
  /**
   * The label of a catalog entry in the current language. `fallback` is the
   * `label` an API object carries itself (a badge's), used while the catalog is
   * not loaded or does not know the id.
   */
  label: (kind: CatalogKind, id: string, fallback?: LocalizedLabel) => string;
  /** Whether the catalog is loaded (the labels of French and English need it unless a fallback is given). */
  ready: boolean;
}

/** `const {label} = useCatalogLabel(); label('positions', 'moderator')`. Re-renders on a language change. */
export function useCatalogLabel(): CatalogLabels {
  const language = useLanguage();
  const {data: catalog} = useCatalog();
  const label = useCallback(
    (kind: CatalogKind, id: string, fallback?: LocalizedLabel) =>
      pickCatalogLabel({
        language,
        id,
        label: catalogLookup(catalog, kind, id)?.label ?? fallback,
        translated: translation(language, kind, id),
      }),
    [catalog, language],
  );
  return {label, ready: catalog !== undefined};
}
