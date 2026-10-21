/** Which flag stands for each catalog language (flag-icons, 4:3 SVG). */

// Only the flags we map are imported: each becomes one small asset of the build.
import flag_br from 'flag-icons/flags/4x3/br.svg?url';
import flag_cn from 'flag-icons/flags/4x3/cn.svg?url';
import flag_cz from 'flag-icons/flags/4x3/cz.svg?url';
import flag_de from 'flag-icons/flags/4x3/de.svg?url';
import flag_dk from 'flag-icons/flags/4x3/dk.svg?url';
import flag_es from 'flag-icons/flags/4x3/es.svg?url';
import flag_fi from 'flag-icons/flags/4x3/fi.svg?url';
import flag_fr from 'flag-icons/flags/4x3/fr.svg?url';
import flag_gb from 'flag-icons/flags/4x3/gb.svg?url';
import flag_gr from 'flag-icons/flags/4x3/gr.svg?url';
import flag_hu from 'flag-icons/flags/4x3/hu.svg?url';
import flag_id from 'flag-icons/flags/4x3/id.svg?url';
import flag_il from 'flag-icons/flags/4x3/il.svg?url';
import flag_in from 'flag-icons/flags/4x3/in.svg?url';
import flag_it from 'flag-icons/flags/4x3/it.svg?url';
import flag_jp from 'flag-icons/flags/4x3/jp.svg?url';
import flag_kr from 'flag-icons/flags/4x3/kr.svg?url';
import flag_nl from 'flag-icons/flags/4x3/nl.svg?url';
import flag_no from 'flag-icons/flags/4x3/no.svg?url';
import flag_pl from 'flag-icons/flags/4x3/pl.svg?url';
import flag_pt from 'flag-icons/flags/4x3/pt.svg?url';
import flag_ro from 'flag-icons/flags/4x3/ro.svg?url';
import flag_ru from 'flag-icons/flags/4x3/ru.svg?url';
import flag_sa from 'flag-icons/flags/4x3/sa.svg?url';
import flag_se from 'flag-icons/flags/4x3/se.svg?url';
import flag_th from 'flag-icons/flags/4x3/th.svg?url';
import flag_tr from 'flag-icons/flags/4x3/tr.svg?url';
import flag_ua from 'flag-icons/flags/4x3/ua.svg?url';
import flag_vn from 'flag-icons/flags/4x3/vn.svg?url';

const FLAG_FILES: Readonly<Record<string, string>> = {
  br: flag_br,
  cn: flag_cn,
  cz: flag_cz,
  de: flag_de,
  dk: flag_dk,
  es: flag_es,
  fi: flag_fi,
  fr: flag_fr,
  gb: flag_gb,
  gr: flag_gr,
  hu: flag_hu,
  id: flag_id,
  il: flag_il,
  in: flag_in,
  it: flag_it,
  jp: flag_jp,
  kr: flag_kr,
  nl: flag_nl,
  no: flag_no,
  pl: flag_pl,
  pt: flag_pt,
  ro: flag_ro,
  ru: flag_ru,
  sa: flag_sa,
  se: flag_se,
  th: flag_th,
  tr: flag_tr,
  ua: flag_ua,
  vn: flag_vn,
};

/** Catalog language id -> ISO country of the flag that stands for it. */
export const LANGUAGE_COUNTRIES: Readonly<Record<string, string>> = {
  fr: 'fr',
  en: 'gb',
  es: 'es',
  de: 'de',
  pt: 'pt',
  'pt-BR': 'br',
  it: 'it',
  nl: 'nl',
  pl: 'pl',
  ru: 'ru',
  ja: 'jp',
  ko: 'kr',
  zh: 'cn',
  ar: 'sa',
  tr: 'tr',
  sv: 'se',
  uk: 'ua',
  id: 'id',
  vi: 'vn',
  th: 'th',
  el: 'gr',
  ro: 'ro',
  cs: 'cz',
  da: 'dk',
  fi: 'fi',
  no: 'no',
  nb: 'no',
  hu: 'hu',
  he: 'il',
  hi: 'in',
};

/** The URL of the flag file for a catalog language id, or null when none is mapped. */
export function flagUrl(languageId: string): string | null {
  const country = LANGUAGE_COUNTRIES[languageId];
  return country ? (FLAG_FILES[country] ?? null) : null;
}
