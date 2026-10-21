import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {act, renderHook} from '@testing-library/react';
import {createElement, type ReactNode} from 'react';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';

import {i18n, initI18n} from '@/i18n';
import {resources} from '@/i18n/resources';

import lineupDoc from '../../LINEUP.md?raw';

import {CATALOG_KINDS, catalogLookup, pickCatalogLabel, useCatalogLabel} from './catalog';
import {catalogFixture} from './catalog.fixture';
import {queryKeys} from './queryKeys';
import type {Catalog} from './types';

describe('the catalog fixture', () => {
  it('is the catalog of LINEUP.md §4, verbatim', () => {
    const start = lineupDoc.indexOf('### Réponse (valeurs réelles)');
    const block = lineupDoc.slice(lineupDoc.indexOf('```json', start) + 7, lineupDoc.indexOf('```', start + 60));
    expect(JSON.parse(block)).toEqual(catalogFixture);
  });
});

describe('catalog translations', () => {
  type Tree = Record<string, Record<string, string>>;

  for (const language of ['es', 'pt-BR', 'de'] as const) {
    it(`${language} translates every id of every list, and nothing else`, () => {
      const translations = resources[language].catalog as unknown as Tree;
      expect(Object.keys(translations).sort()).toEqual([...CATALOG_KINDS].sort());
      for (const kind of CATALOG_KINDS) {
        const expected = catalogFixture[kind].map((entry) => entry.id).sort();
        expect(Object.keys(translations[kind]!).sort(), `${language}.${kind}`).toEqual(expected);
        for (const [id, text] of Object.entries(translations[kind]!)) {
          expect(text.trim(), `${language}.${kind}.${id}`).not.toBe('');
        }
      }
    });
  }

  it('leaves French and English empty: they use the label of the API', () => {
    expect(resources.fr.catalog).toEqual({});
    expect(resources.en.catalog).toEqual({});
  });
});

describe('catalogLookup', () => {
  it('finds an entry by id in a list', () => {
    expect(catalogLookup(catalogFixture, 'positions', 'moderator')?.label.en).toBe('Moderator');
    expect(catalogLookup(catalogFixture, 'requirements', 'custom')?.requires_label).toBe(true);
    expect(catalogLookup(catalogFixture, 'badges', 'lineup_verified')?.source).toBe('manual');
  });

  it('is undefined for an unknown id or without a catalog', () => {
    expect(catalogLookup(catalogFixture, 'positions', 'wizard')).toBeUndefined();
    expect(catalogLookup(undefined, 'positions', 'moderator')).toBeUndefined();
  });
});

describe('pickCatalogLabel', () => {
  const label = {fr: 'Modérateur', en: 'Moderator'};

  it('uses the API label in French and English', () => {
    expect(pickCatalogLabel({language: 'fr', id: 'moderator', label, translated: 'x'})).toBe('Modérateur');
    expect(pickCatalogLabel({language: 'en', id: 'moderator', label, translated: 'x'})).toBe('Moderator');
  });

  it('uses the translation in the other languages, else English', () => {
    expect(pickCatalogLabel({language: 'de', id: 'moderator', label, translated: 'Moderator:in'})).toBe('Moderator:in');
    expect(pickCatalogLabel({language: 'es', id: 'moderator', label, translated: undefined})).toBe('Moderator');
  });

  it('shows the id when nothing is known', () => {
    for (const language of ['fr', 'en', 'es', 'pt-BR', 'de'] as const) {
      expect(pickCatalogLabel({language, id: 'wizard', label: undefined, translated: undefined})).toBe('wizard');
    }
  });

  it('can still translate while the catalog is not loaded', () => {
    expect(pickCatalogLabel({language: 'de', id: 'moderator', label: undefined, translated: 'Moderator'})).toBe(
      'Moderator',
    );
  });
});

describe('useCatalogLabel', () => {
  const client = new QueryClient();
  client.setQueryData<Catalog>(queryKeys.catalog(), catalogFixture);
  const wrapper = ({children}: {children: ReactNode}) => createElement(QueryClientProvider, {client}, children);

  beforeAll(() => {
    initI18n();
  });
  afterAll(async () => {
    await i18n.changeLanguage('en');
  });

  it('follows the language', async () => {
    const {result} = renderHook(() => useCatalogLabel(), {wrapper});
    const labels = async (language: string) => {
      await act(async () => {
        await i18n.changeLanguage(language);
      });
      return ['positions', 'themes', 'badges'].map((kind, index) =>
        result.current.label(kind as 'positions', ['event_animator', 'esport', 'discord_staff'][index]!),
      );
    };
    expect(await labels('fr')).toEqual(["Animateur d'événements", 'Esport', 'Employé Discord']);
    expect(await labels('en')).toEqual(['Event host', 'Esports', 'Discord staff']);
    expect(await labels('de')).toEqual(['Eventleitung', 'E-Sport', 'Discord-Mitarbeiter']);
    expect(await labels('es')).toEqual(['Animador de eventos', 'Esports', 'Empleado de Discord']);
    expect(await labels('pt-BR')).toEqual(['Animador de eventos', 'Esports', 'Funcionário do Discord']);
  });

  it('shows the id of an entry the catalog does not know, or the label the object carries', async () => {
    const {result} = renderHook(() => useCatalogLabel(), {wrapper});
    await act(async () => {
      await i18n.changeLanguage('fr');
    });
    expect(result.current.label('positions', 'wizard')).toBe('wizard');
    expect(result.current.label('badges', 'new_badge', {fr: 'Nouveau', en: 'New'})).toBe('Nouveau');
    expect(result.current.ready).toBe(true);
  });
});
