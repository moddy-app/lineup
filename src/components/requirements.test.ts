import {beforeAll, describe, expect, it} from 'vitest';

import {catalogFixture} from '@/api/catalog.fixture';
import type {CatalogRequirement, Requirement} from '@/api/types';
import {i18n} from '@/i18n';
import {formatNumber} from '@/lib/format';
import {useFrench} from '@/test/harness';

import type {ComponentsT} from './componentsT';
import {
  approxDuration,
  describeRequirementValue,
  requirementIcon,
  requirementView,
  viewerMeets,
  withoutUnit,
} from './requirements';

const req = (type: string, value: Requirement['value'], extra: Partial<Requirement> = {}): Requirement => ({
  type,
  value,
  label: null,
  verified_by_lineup: false,
  ...extra,
});

const entry = (id: string) =>
  catalogFixture.requirements.find((candidate) => candidate.id === id) as CatalogRequirement;
const names: Record<string, string> = {fr: 'Français', en: 'Anglais', es: 'Espagnol'};

let t: ComponentsT;
beforeAll(async () => {
  await useFrench();
  t = i18n.getFixedT('fr', 'components');
});
const ctx = () => ({t, languageName: (id: string) => names[id] ?? id});

describe('approxDuration', () => {
  it('says nothing under two months: the days read well alone', () => {
    expect(approxDuration(0)).toBeNull();
    expect(approxDuration(59)).toBeNull();
  });

  it('gives months up to two years, then years', () => {
    expect(approxDuration(60)).toEqual({unit: 'months', value: 2});
    expect(approxDuration(180)).toEqual({unit: 'months', value: 6});
    expect(approxDuration(365)).toEqual({unit: 'months', value: 12});
    expect(approxDuration(700)).toEqual({unit: 'months', value: 23});
    expect(approxDuration(730)).toEqual({unit: 'years', value: 2});
    expect(approxDuration(1095)).toEqual({unit: 'years', value: 3});
    expect(approxDuration(3650)).toEqual({unit: 'years', value: 10});
  });
});

describe('withoutUnit', () => {
  it('drops the unit the value carries itself', () => {
    expect(withoutUnit('Ancienneté du compte Discord (jours)')).toBe('Ancienneté du compte Discord');
    expect(withoutUnit('Expérience (mois)')).toBe('Expérience');
    expect(withoutUnit('Disponibilité (heures par semaine)')).toBe('Disponibilité');
  });

  it('leaves a label without a unit, and never returns an empty one', () => {
    expect(withoutUnit('Langues parlées')).toBe('Langues parlées');
    expect(withoutUnit('(jours)')).toBe('(jours)');
  });
});

describe('describeRequirementValue (French)', () => {
  it('writes the minimum age', () => {
    expect(describeRequirementValue(req('min_age', 16), ctx())).toBe('16 ans minimum');
  });

  it('gives the age of the account in days and, past two months, roughly', () => {
    expect(describeRequirementValue(req('account_age_days', 180), ctx())).toBe('180 jours, environ 6 mois');
    expect(describeRequirementValue(req('account_age_days', 45), ctx())).toBe('45 jours');
    expect(describeRequirementValue(req('account_age_days', 1), ctx())).toBe('1 jour');
    expect(describeRequirementValue(req('account_age_days', 1095), ctx())).toBe(
      `${formatNumber(1095)} jours, environ 3 ans`,
    );
  });

  it('puts a unit on months and weekly hours', () => {
    expect(describeRequirementValue(req('experience_months', 6), ctx())).toBe('6 mois');
    expect(describeRequirementValue(req('availability_hours', 1), ctx())).toBe('1 heure par semaine');
    expect(describeRequirementValue(req('availability_hours', 5), ctx())).toBe('5 heures par semaine');
  });

  it('names the languages', () => {
    expect(describeRequirementValue(req('languages', ['fr', 'en']), ctx())).toBe('Français, Anglais');
    expect(describeRequirementValue(req('languages', []), ctx())).toBeNull();
  });

  it('says whether the microphone is required', () => {
    expect(describeRequirementValue(req('voice_required', true), ctx())).toBe('Micro requis');
    expect(describeRequirementValue(req('voice_required', false), ctx())).toBe('Micro non requis');
  });

  it('keeps free text as written, and has nothing for a condition without a value', () => {
    expect(describeRequirementValue(req('server_activity', 'Actif le soir'), ctx())).toBe('Actif le soir');
    expect(describeRequirementValue(req('server_activity', '  '), ctx())).toBeNull();
    expect(describeRequirementValue(req('verified_experience', null), ctx())).toBeNull();
  });

  it('shows the bare number of an int condition it does not know', () => {
    expect(describeRequirementValue(req('future_thing', 7), ctx())).toBe('7');
  });
});

describe('describeRequirementValue (English)', () => {
  it('reads naturally', () => {
    const en = i18n.getFixedT('en', 'components');
    const english = {t: en, languageName: (id: string) => id};
    expect(describeRequirementValue(req('min_age', 16), english)).toBe('16 years old or more');
    expect(describeRequirementValue(req('account_age_days', 180), english)).toBe('180 days, about 6 months');
    expect(describeRequirementValue(req('voice_required', true), english)).toBe('Microphone required');
  });
});

describe('requirementView', () => {
  it('shows the catalog name without its unit, then the value', () => {
    const view = requirementView(
      req('account_age_days', 180, {verified_by_lineup: true}),
      entry('account_age_days'),
      'Ancienneté du compte Discord (jours)',
      ctx(),
    );
    expect(view).toMatchObject({
      title: 'Ancienneté du compte Discord',
      text: '180 jours, environ 6 mois',
      icon: 'calendar_month',
      promise: true,
    });
  });

  it('gives a custom condition its own title and its text as value', () => {
    const view = requirementView(
      req('custom', 'Savoir utiliser Moddy', {label: 'Outils'}),
      entry('custom'),
      'Condition personnalisée',
      ctx(),
    );
    expect(view).toMatchObject({title: 'Outils', text: 'Savoir utiliser Moddy', promise: false});
  });

  it('falls back to the catalog name for a custom condition without a title', () => {
    const view = requirementView(req('custom', 'x', {label: '  '}), entry('custom'), 'Condition personnalisée', ctx());
    expect(view.title).toBe('Condition personnalisée');
  });

  it('writes a yes/no condition as one sentence', () => {
    const view = requirementView(req('voice_required', true), entry('voice_required'), 'Micro / vocal requis', ctx());
    expect(view).toMatchObject({title: 'Micro requis', text: null});
  });

  it('keeps the name alone for a condition with no value', () => {
    const view = requirementView(
      req('verified_experience', null, {verified_by_lineup: true}),
      entry('verified_experience'),
      'Expérience vérifiée sur Lineup',
      ctx(),
    );
    expect(view).toMatchObject({title: 'Expérience vérifiée sur Lineup', text: null, promise: true});
  });

  it('copes with a type the catalog does not know', () => {
    const view = requirementView(req('wizard', 3), undefined, 'wizard', ctx());
    expect(view).toMatchObject({title: 'wizard', text: '3', icon: 'task_alt'});
  });
});

describe('requirementIcon', () => {
  it('has one for every catalog type', () => {
    for (const {id} of catalogFixture.requirements) expect(requirementIcon(id), id).not.toBe('task_alt');
  });
});

describe('viewerMeets (for information only)', () => {
  const now = Date.parse('2026-10-20T12:00:00Z');
  const viewer = {accountCreatedAt: '2026-01-01T00:00:00+00:00', hasVerifiedExperience: false};

  it('compares the age of the account with the condition', () => {
    // 292 days old.
    expect(viewerMeets(req('account_age_days', 180), viewer, now)).toBe(true);
    expect(viewerMeets(req('account_age_days', 292), viewer, now)).toBe(true);
    expect(viewerMeets(req('account_age_days', 293), viewer, now)).toBe(false);
  });

  it('reads whether the viewer has a verified experience', () => {
    expect(viewerMeets(req('verified_experience', null), viewer, now)).toBe(false);
    expect(viewerMeets(req('verified_experience', null), {...viewer, hasVerifiedExperience: true}, now)).toBe(true);
  });

  it('says nothing about a condition only the viewer can know', () => {
    for (const type of ['min_age', 'languages', 'voice_required', 'custom', 'availability_hours']) {
      expect(viewerMeets(req(type, 1), viewer, now), type).toBeNull();
    }
  });
});
