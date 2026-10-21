import {apiFetch} from '../client';
import type {Catalog} from '../types';
import type {ReadOptions} from './shared';

/** `GET /lineup/catalog`: public, cached for an hour by the browser. */
export function getCatalog({signal}: ReadOptions = {}): Promise<Catalog> {
  return apiFetch<Catalog>('/lineup/catalog', {signal});
}
