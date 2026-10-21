/**
 * The chip bookkeeping of the `FilterBar`, without React: which chips are
 * shown, in which order, and what is left to add.
 */

export interface ChipState<K extends string> {
  /** The keys in the order they were added. May hold keys whose chip is gone. */
  order: readonly K[];
  /** The chip whose popover is open. */
  open: K | null;
  /** The chip just added, whose popover has not opened yet. */
  adding: K | null;
}

/**
 * The chips to show, in order: those added (or with a value) and still
 * wanted (a value, an open popover, or about to open one), then the filters
 * that got a value from elsewhere (the URL) and were never added here, in
 * definition order.
 */
export function activeKeys<K extends string>(
  keys: readonly K[],
  state: ChipState<K>,
  hasValue: (key: K) => boolean,
): K[] {
  const wanted = (key: K) => hasValue(key) || key === state.open || key === state.adding;
  const added = state.order.filter((key) => keys.includes(key) && wanted(key));
  const external = keys.filter((key) => !state.order.includes(key) && wanted(key));
  return [...added, ...external];
}

/** The filters that can still be added. */
export function remainingKeys<K extends string>(keys: readonly K[], active: readonly K[]): K[] {
  return keys.filter((key) => !active.includes(key));
}

/** `key` goes to the end of the order (a key listed already moves there). */
export function appendKey<K extends string>(order: readonly K[], key: K): K[] {
  return [...order.filter((existing) => existing !== key), key];
}

/** The selection after a click on `value`: `single` replaces (or clears), `multi` toggles. */
export function toggleValue(kind: 'single' | 'multi', current: readonly string[], value: string): string[] {
  const selected = current.includes(value);
  if (kind === 'single') return selected ? [] : [value];
  return selected ? current.filter((existing) => existing !== value) : [...current, value];
}
