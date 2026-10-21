/**
 * How a post's conditions read (LINEUP.md §4 "Lecture des conditions" and §8).
 * Pure functions: the component only lays the result out.
 */

import type {CatalogRequirement, Requirement} from '@/api/types';
import {formatNumber} from '@/lib/format';

import type {ComponentsT} from './componentsT';
import {daysBetween} from './dates';

/** The icon of each condition type; a type the site does not know yet gets a generic one. */
const REQUIREMENT_ICONS: Readonly<Record<string, string>> = {
  min_age: 'cake',
  account_age_days: 'calendar_month',
  server_activity: 'forum',
  experience_months: 'work_history',
  verified_experience: 'verified',
  languages: 'translate',
  availability_hours: 'schedule',
  voice_required: 'mic',
  custom: 'checklist',
};

export function requirementIcon(type: string): string {
  return REQUIREMENT_ICONS[type] ?? 'task_alt';
}

/** "Ancienneté du compte Discord (jours)" becomes "Ancienneté du compte Discord": the value carries its unit. */
export function withoutUnit(label: string): string {
  return label.replace(/\s*\([^()]*\)\s*$/, '') || label;
}

export type ApproxDuration = {unit: 'months' | 'years'; value: number};

/** A rough human duration for a number of days, or null when the days read well alone (under two months). */
export function approxDuration(days: number): ApproxDuration | null {
  if (days < 60) return null;
  const months = Math.round(days / 30.4375);
  if (months >= 24) return {unit: 'years', value: Math.max(2, Math.round(days / 365.25))};
  return {unit: 'months', value: months};
}

export interface DescribeContext {
  t: ComponentsT;
  /** The name of a language id in the current language. */
  languageName: (id: string) => string;
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** "180 jours, environ 6 mois". */
function accountAge(days: number, t: ComponentsT): string {
  const text = t('requirement.unit.days', {count: days, value: formatNumber(days)});
  const approx = approxDuration(days);
  if (!approx) return text;
  const rough =
    approx.unit === 'years'
      ? t('requirement.unit.years', {count: approx.value, value: formatNumber(approx.value)})
      : t('requirement.unit.months', {count: approx.value, value: formatNumber(approx.value)});
  return t('requirement.daysApprox', {days: text, approx: rough});
}

/**
 * The value of a condition as a sentence part ("16 ans minimum", "Français, Anglais"),
 * or null when the condition has none to show (`none` type, or a value of an
 * unexpected shape).
 */
export function describeRequirementValue(requirement: Requirement, ctx: DescribeContext): string | null {
  const {type, value} = requirement;
  const {t, languageName} = ctx;

  if (isNumber(value)) {
    switch (type) {
      case 'min_age':
        return t('requirement.minAge', {count: value, value: formatNumber(value)});
      case 'account_age_days':
        return accountAge(value, t);
      case 'experience_months':
        return t('requirement.unit.months', {count: value, value: formatNumber(value)});
      case 'availability_hours':
        return t('requirement.unit.hoursPerWeek', {count: value, value: formatNumber(value)});
      default:
        return formatNumber(value);
    }
  }
  if (typeof value === 'boolean') {
    return type === 'voice_required' ? t(value ? 'requirement.voice.required' : 'requirement.voice.notRequired') : null;
  }
  if (Array.isArray(value)) return value.length > 0 ? value.map(languageName).join(', ') : null;
  if (typeof value === 'string') return value.trim() === '' ? null : value;
  return null;
}

export interface RequirementView {
  /** The first line: what the condition is. */
  title: string;
  /** The second line: its value; null when the title says it all. */
  text: string | null;
  icon: string;
  /** Lineup plans to check it (never "checked"). */
  promise: boolean;
}

/**
 * The two lines of a condition. `label` is the catalog's name for its type;
 * a `custom` condition brings its own title. A yes/no condition is one
 * sentence ("Micro requis"), not a label and a value.
 */
export function requirementView(
  requirement: Requirement,
  catalogEntry: CatalogRequirement | undefined,
  label: string,
  ctx: DescribeContext,
): RequirementView {
  const value = describeRequirementValue(requirement, ctx);
  const base = {icon: requirementIcon(requirement.type), promise: requirement.verified_by_lineup};

  if (typeof requirement.value === 'boolean' && value) return {...base, title: value, text: null};
  if (requirement.type === 'custom') return {...base, title: requirement.label?.trim() || label, text: value};

  const numeric = catalogEntry ? catalogEntry.value_type === 'int' : isNumber(requirement.value);
  return {...base, title: numeric ? withoutUnit(label) : label, text: value};
}

/** What the viewer's own account says about a condition Lineup can read from it. */
export interface RequirementViewer {
  /** `created_at` of the viewer's profile: when their Discord account was created. */
  accountCreatedAt: string;
  /** At least one of their experiences is verified. */
  hasVerifiedExperience: boolean;
}

/**
 * Whether the viewer meets a condition, for information only (LINEUP.md §8):
 * `true` or `false` for the two conditions Lineup can read (`account_age_days`,
 * `verified_experience`), null for every other, where nothing can be said.
 */
export function viewerMeets(requirement: Requirement, viewer: RequirementViewer, now: number): boolean | null {
  if (requirement.type === 'verified_experience') return viewer.hasVerifiedExperience;
  if (requirement.type === 'account_age_days' && isNumber(requirement.value)) {
    return daysBetween(viewer.accountCreatedAt, now) >= requirement.value;
  }
  return null;
}
