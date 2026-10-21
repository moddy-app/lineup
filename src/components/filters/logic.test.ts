import {describe, expect, it} from 'vitest';

import {activeKeys, appendKey, type ChipState, remainingKeys, toggleValue} from './logic';

type K = 'position' | 'language' | 'theme';
const KEYS: K[] = ['position', 'language', 'theme'];
const state = (partial: Partial<ChipState<K>> = {}): ChipState<K> => ({
  order: [],
  open: null,
  adding: null,
  ...partial,
});

describe('activeKeys', () => {
  it('shows no chip when nothing has a value and nothing is being added', () => {
    expect(activeKeys(KEYS, state(), () => false)).toEqual([]);
  });

  it('starts from the filters that have a value, in definition order', () => {
    expect(activeKeys(KEYS, state(), (key) => key !== 'language')).toEqual(['position', 'theme']);
  });

  it('keeps the order of addition', () => {
    expect(activeKeys(KEYS, state({order: ['theme', 'position']}), () => true)).toEqual([
      'theme',
      'position',
      'language',
    ]);
  });

  it('keeps an empty chip while it is being added or its popover is open, and drops it afterwards', () => {
    expect(activeKeys(KEYS, state({order: ['theme'], adding: 'theme'}), () => false)).toEqual(['theme']);
    expect(activeKeys(KEYS, state({order: ['theme'], open: 'theme'}), () => false)).toEqual(['theme']);
    expect(activeKeys(KEYS, state({order: ['theme']}), () => false)).toEqual([]);
  });

  it('ignores keys that are not filters any more', () => {
    expect(activeKeys(KEYS, state({order: ['gone' as K, 'theme']}), () => true)).toEqual([
      'theme',
      'position',
      'language',
    ]);
  });
});

describe('remainingKeys and appendKey', () => {
  it('lists the filters not in use', () => {
    expect(remainingKeys(KEYS, ['language'])).toEqual(['position', 'theme']);
    expect(remainingKeys(KEYS, KEYS)).toEqual([]);
  });

  it('moves a key to the end', () => {
    expect(appendKey(['position', 'language'], 'theme')).toEqual(['position', 'language', 'theme']);
    expect(appendKey(['position', 'language'], 'position')).toEqual(['language', 'position']);
  });
});

describe('toggleValue', () => {
  it('replaces or clears for a single filter', () => {
    expect(toggleValue('single', [], 'a')).toEqual(['a']);
    expect(toggleValue('single', ['a'], 'b')).toEqual(['b']);
    expect(toggleValue('single', ['a'], 'a')).toEqual([]);
  });

  it('adds or removes for a multi filter', () => {
    expect(toggleValue('multi', ['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleValue('multi', ['a', 'b'], 'a')).toEqual(['b']);
  });
});
