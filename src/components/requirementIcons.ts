/** The Material Symbol of each condition of the catalog (LINEUP.md §4, `requirements`). */

export const FALLBACK_REQUIREMENT_ICON = 'checklist';

const REQUIREMENT_ICONS: Readonly<Record<string, string>> = {
  min_age: 'cake',
  account_age_days: 'history',
  server_activity: 'forum',
  experience_months: 'work_history',
  verified_experience: 'verified',
  languages: 'translate',
  availability_hours: 'schedule',
  voice_required: 'mic',
  custom: 'checklist',
};

/** The icon of a condition type; a type the site does not know yet gets a generic one. */
export function requirementIcon(type: string): string {
  return REQUIREMENT_ICONS[type] ?? FALLBACK_REQUIREMENT_ICON;
}
