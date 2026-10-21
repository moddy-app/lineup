import 'i18next';

import type {Resources} from './resources';

/**
 * Types the keys: t('nope') is a compile error. English is the source of
 * truth; locales.test.ts checks the other four languages follow it.
 */
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: Resources;
  }
}
