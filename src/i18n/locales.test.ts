import {describe, expect, it} from 'vitest';

import {LANGUAGE_CODES, resolveLanguage} from './languages';
import {en, NAMESPACES, resources} from './resources';

type Tree = {[key: string]: string | Tree};

/** Every leaf of a translation file as a dotted path. */
function leaves(tree: Tree, prefix = ''): Array<[string, unknown]> {
  return Object.entries(tree).flatMap(([key, value]) =>
    typeof value === 'object' && value !== null ? leaves(value, `${prefix}${key}.`) : [[`${prefix}${key}`, value]],
  );
}

/** {{name}} placeholders and <tag> markers, which every language must keep. */
const placeholders = (text: string) =>
  [...text.matchAll(/\{\{\s*[\w.]+\s*\}\}|<\/?\w+>/g)].map((match) => match[0].replace(/\s+/g, '')).sort();

const others = LANGUAGE_CODES.filter((code) => code !== 'en');

/**
 * `catalog` is the one namespace that is not complete in English: French and
 * English use the labels of the API (empty files), and es, pt-BR and de translate
 * every catalog id (src/api/catalog.test.ts checks that they are all there). It
 * is exempt from the key-for-key comparison with English, not from the rest.
 */
const API_LABELLED = 'catalog';

describe('locales', () => {
  it('has the same five languages everywhere', () => {
    expect(Object.keys(resources).sort()).toEqual([...LANGUAGE_CODES].sort());
    for (const code of LANGUAGE_CODES) {
      expect(Object.keys(resources[code]).sort(), code).toEqual([...NAMESPACES].sort());
    }
  });

  for (const ns of NAMESPACES) {
    describe(ns, () => {
      const source = new Map(leaves(en[ns] as Tree));

      it('has no empty value in English', () => {
        for (const [key, value] of source) expect(value, `en.${ns}.${key}`).not.toBe('');
      });

      for (const code of others) {
        it(`${code} has every English key, none extra, and no empty value`, () => {
          const target = new Map(leaves(resources[code][ns] as Tree));
          if (ns !== API_LABELLED)
            expect([...target.keys()].sort(), `${code}.${ns}`).toEqual([...source.keys()].sort());
          for (const [key, value] of target) {
            expect(typeof value, `${code}.${ns}.${key}`).toBe('string');
            expect((value as string).trim(), `${code}.${ns}.${key}`).not.toBe('');
          }
        });

        it(`${code} keeps the placeholders of English`, () => {
          const target = new Map(leaves(resources[code][ns] as Tree));
          for (const [key, value] of source) {
            expect(placeholders(String(target.get(key) ?? '')), `${code}.${ns}.${key}`).toEqual(
              placeholders(String(value)),
            );
          }
        });
      }
    });
  }
});

describe('resolveLanguage', () => {
  it('maps browser tags to the five languages', () => {
    expect(resolveLanguage('pt')).toBe('pt-BR');
    expect(resolveLanguage('pt-PT')).toBe('pt-BR');
    expect(resolveLanguage('fr-CA')).toBe('fr');
    expect(resolveLanguage('de_AT')).toBe('de');
    expect(resolveLanguage('ES-mx')).toBe('es');
    expect(resolveLanguage('en-GB')).toBe('en');
  });

  it('rejects what Lineup does not translate', () => {
    expect(resolveLanguage('ja')).toBeNull();
    expect(resolveLanguage('')).toBeNull();
    expect(resolveLanguage(null)).toBeNull();
  });
});

/**
 * Copy rules (design-kit/DESIGN-SYSTEM.md §8): no exclamation marks, emojis
 * or dash incises, no marketing filler. Rhythm and rhetorical questions
 * cannot be linted: they are for review.
 */
describe('copy rules', () => {
  const FILLER =
    /seamless|powerful|unlock|elevate|supercharge|revolutioni[sz]e|next level|boost your|game[- ]chang|puissant|débloqu|boostez|décupl|révolutionn|sans effort|potente|desbloque|impulsa tu|poderos|turbine|nahtlos|mächtig|freischalten|entfessel/i;

  for (const code of LANGUAGE_CODES) {
    it(`${code} follows them`, () => {
      for (const ns of NAMESPACES) {
        for (const [key, value] of leaves(resources[code][ns] as Tree)) {
          const where = `${code}.${ns}.${key}`;
          const text = String(value);
          expect(text, where).not.toMatch(/!/);
          expect(text, where).not.toMatch(/\p{Extended_Pictographic}/u);
          expect(text, where).not.toMatch(/[—–]/);
          expect(text, where).not.toMatch(FILLER);
        }
      }
    });
  }
});
