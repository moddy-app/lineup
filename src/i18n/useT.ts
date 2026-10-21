import {useTranslation} from 'react-i18next';

import type {Namespace} from './resources';

/** `useTranslation` for one feature namespace, with typed keys. */
export function useT<N extends Namespace>(ns: N) {
  return useTranslation(ns);
}
