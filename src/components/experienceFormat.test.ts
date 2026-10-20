import {beforeAll, describe, expect, it} from 'vitest';

import type {PublicVerification} from '@/api/types';
import {i18n} from '@/i18n';
import {useFrench} from '@/test/harness';

import type {ComponentsT} from './componentsT';
import {formatDuration, formatRange, monthsBetween, verificationView} from './experienceFormat';

let t: ComponentsT;
beforeAll(async () => {
  await useFrench();
  t = i18n.getFixedT('fr', 'components');
});

const today = new Date(2026, 9, 20); // 20 October 2026, local

describe('monthsBetween', () => {
  it('counts whole months until today for an experience that goes on', () => {
    expect(monthsBetween('2024-03-01', null, today)).toBe(31);
    expect(monthsBetween('2026-10-20', null, today)).toBe(0);
    expect(monthsBetween('2026-09-21', null, today)).toBe(0);
    expect(monthsBetween('2026-09-20', null, today)).toBe(1);
  });

  it('counts the end day itself: April 2021 to the end of March 2023 is two years', () => {
    expect(monthsBetween('2021-04-01', '2023-03-31')).toBe(24);
    expect(monthsBetween('2021-01-15', '2023-03-31')).toBe(26);
  });

  it('is zero for a short stay or an impossible range', () => {
    expect(monthsBetween('2024-03-15', '2024-04-10')).toBe(0);
    expect(monthsBetween('2024-05-01', '2024-03-01')).toBe(0);
  });

  it('crosses a year and a month end without drifting', () => {
    expect(monthsBetween('2025-12-31', '2026-01-30')).toBe(1);
    expect(monthsBetween('2025-12-31', '2026-01-29')).toBe(0);
    expect(monthsBetween('2025-12-31', '2026-02-28')).toBe(2);
  });
});

describe('formatDuration (French)', () => {
  it('writes years and months', () => {
    expect(formatDuration(0, t)).toBe("moins d'un mois");
    expect(formatDuration(1, t)).toBe('1 mois');
    expect(formatDuration(7, t)).toBe('7 mois');
    expect(formatDuration(12, t)).toBe('1 an');
    expect(formatDuration(24, t)).toBe('2 ans');
    expect(formatDuration(27, t)).toBe('2 ans 3 mois');
    expect(formatDuration(13, t)).toBe('1 an 1 mois');
  });

  it('joins years and months the way each language does', () => {
    expect(formatDuration(31, i18n.getFixedT('en', 'components'))).toBe('2 years 7 months');
    expect(formatDuration(31, i18n.getFixedT('es', 'components'))).toBe('2 años y 7 meses');
    expect(formatDuration(31, i18n.getFixedT('pt-BR', 'components'))).toBe('2 anos e 7 meses');
    expect(formatDuration(31, i18n.getFixedT('de', 'components'))).toBe('2 Jahre und 7 Monate');
  });
});

describe('formatRange (French)', () => {
  it('names the month and year, without a time zone shift', () => {
    expect(formatRange('2024-03-01', null, t)).toBe("mars 2024 à aujourd'hui");
    expect(formatRange('2021-01-01', '2023-03-31', t)).toBe('janvier 2021 à mars 2023');
    expect(formatRange('2024-01-01', '2024-12-31', t)).toBe('janvier 2024 à décembre 2024');
  });
});

describe('verificationView', () => {
  const verification = (overrides: Partial<PublicVerification>): PublicVerification => ({
    status: 'unverified',
    method: null,
    verified_at: null,
    ...overrides,
  });

  it('shows a Discord verification in accent, with a check and how and when', () => {
    const view = verificationView(
      verification({status: 'verified', method: 'discord_oauth', verified_at: '2026-10-20T12:00:00+00:00'}),
      t,
    );
    expect(view).toMatchObject({key: 'verified', variant: 'accent', icon: 'check'});
    expect(view.tip).toBe('Vérifiée via Discord le 20 octobre 2026');
  });

  it('says the Moddy team verified it for a manual check, and for the reserved system method', () => {
    for (const method of ['moddy_staff', 'moddy_staff_system'] as const) {
      const view = verificationView(
        verification({status: 'verified', method, verified_at: '2026-10-20T12:00:00+00:00'}),
        t,
      );
      expect(view.tip).toBe("Vérifiée par l'équipe Moddy le 20 octobre 2026");
    }
  });

  it('still says verified when the method is missing, and gives no tip without a date', () => {
    expect(verificationView(verification({status: 'verified', verified_at: '2026-10-20T12:00:00+00:00'}), t).tip).toBe(
      'Vérifiée le 20 octobre 2026',
    );
    expect(verificationView(verification({status: 'verified'}), t)).toMatchObject({key: 'verified', tip: null});
  });

  it('maps pending, unverified and rejected', () => {
    expect(verificationView(verification({status: 'pending'}), t)).toEqual({
      key: 'pending',
      variant: 'strong',
      icon: null,
      tip: "L'équipe Moddy examine la demande.",
    });
    expect(verificationView(verification({status: 'unverified'}), t)).toEqual({
      key: 'unverified',
      variant: 'neutral',
      icon: null,
      tip: null,
    });
    expect(verificationView(verification({status: 'rejected'}), t)).toEqual({
      key: 'rejected',
      variant: 'error',
      icon: null,
      tip: null,
    });
  });
});
