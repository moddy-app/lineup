/** The experience form: state, checks, the body of a save and what a change does to the verification (LINEUP.md §6.6, §7). */

import type {CalendarDate, CreateExperienceBody, PrivateExperience, UpdateExperienceBody} from '@/api/types';

export const NAME_MAX = 100;
export const DESCRIPTION_MAX = 1000;
export const POSITION_OTHER_MAX = 40;
export const NOTE_MAX = 500;
export const IMAGE_URL_MAX = 500;

export interface ExperienceFormState {
  kind: 'guild' | 'service';
  invite: string;
  name: string;
  /** A service only: an https URL, or empty. */
  image_url: string;
  position: string;
  position_other: string;
  description: string;
  start_date: string;
  end_date: string;
  /** "Je suis toujours en poste": no end date. */
  current: boolean;
}

export type ExperienceProblemKey =
  | 'inviteRequired'
  | 'nameRequired'
  | 'nameTooLong'
  | 'imageTooLong'
  | 'imageNotHttps'
  | 'positionRequired'
  | 'positionOtherRequired'
  | 'positionOtherTooLong'
  | 'descriptionTooLong'
  | 'startRequired'
  | 'startFuture'
  | 'endRequired'
  | 'endFuture'
  | 'endBeforeStart';

export interface ExperienceProblem {
  key: ExperienceProblemKey;
  count?: number;
}

export type ExperienceProblems = Partial<Record<keyof ExperienceFormState, ExperienceProblem>>;

/** Local calendar day, `YYYY-MM-DD`. */
export function todayIso(now: Date = new Date()): CalendarDate {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function emptyForm(): ExperienceFormState {
  return {
    kind: 'guild',
    invite: '',
    name: '',
    image_url: '',
    position: '',
    position_other: '',
    description: '',
    start_date: '',
    end_date: '',
    current: true,
  };
}

export function formFromExperience(experience: PrivateExperience): ExperienceFormState {
  return {
    kind: experience.kind,
    invite: '',
    name: experience.name,
    image_url: experience.kind === 'service' ? (experience.image_url ?? '') : '',
    position: experience.position,
    position_other: experience.position_other ?? '',
    description: experience.description ?? '',
    start_date: experience.start_date,
    end_date: experience.end_date ?? '',
    current: experience.end_date === null,
  };
}

/** An image is an https URL of 500 characters at most, without spaces. Empty is fine. */
export function imageProblem(value: string): ExperienceProblem | null {
  const url = value.trim();
  if (url.length === 0) return null;
  if (url.length > IMAGE_URL_MAX) return {key: 'imageTooLong', count: IMAGE_URL_MAX};
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || /\s/.test(url) || parsed.username || parsed.password) {
      return {key: 'imageNotHttps'};
    }
  } catch {
    return {key: 'imageNotHttps'};
  }
  return null;
}

export function validateExperience(
  state: ExperienceFormState,
  options: {editing: boolean; today?: string},
): ExperienceProblems {
  const today = options.today ?? todayIso();
  const problems: ExperienceProblems = {};
  if (state.kind === 'guild') {
    if (!options.editing && state.invite.trim().length === 0) problems.invite = {key: 'inviteRequired'};
  } else {
    const name = state.name.trim();
    if (name.length === 0) problems.name = {key: 'nameRequired'};
    else if (name.length > NAME_MAX) problems.name = {key: 'nameTooLong', count: NAME_MAX};
    const image = imageProblem(state.image_url);
    if (image) problems.image_url = image;
  }
  if (!state.position) problems.position = {key: 'positionRequired'};
  if (state.position === 'other') {
    const other = state.position_other.trim();
    if (other.length === 0) problems.position_other = {key: 'positionOtherRequired'};
    else if (other.length > POSITION_OTHER_MAX)
      problems.position_other = {key: 'positionOtherTooLong', count: POSITION_OTHER_MAX};
  }
  if (state.description.length > DESCRIPTION_MAX)
    problems.description = {key: 'descriptionTooLong', count: DESCRIPTION_MAX};
  if (!state.start_date) problems.start_date = {key: 'startRequired'};
  else if (state.start_date > today) problems.start_date = {key: 'startFuture'};
  if (!state.current) {
    if (!state.end_date) problems.end_date = {key: 'endRequired'};
    else if (state.end_date > today) problems.end_date = {key: 'endFuture'};
    else if (state.start_date && state.end_date < state.start_date) problems.end_date = {key: 'endBeforeStart'};
  }
  return problems;
}

/** The text shared by creation and edition. */
function common(state: ExperienceFormState) {
  return {
    position: state.position,
    ...(state.position === 'other' ? {position_other: state.position_other.trim()} : {}),
    description: state.description.trim() || null,
    start_date: state.start_date,
    end_date: state.current ? null : state.end_date,
  };
}

export function createBody(state: ExperienceFormState): CreateExperienceBody {
  return state.kind === 'guild'
    ? {kind: 'guild', invite: state.invite.trim(), ...common(state)}
    : {kind: 'service', name: state.name.trim(), image_url: state.image_url.trim() || null, ...common(state)};
}

/** Only what changed. A new invitation is sent when one was typed. */
export function updateBody(experience: PrivateExperience, state: ExperienceFormState): UpdateExperienceBody {
  const body: UpdateExperienceBody = {};
  if (experience.kind === 'guild') {
    if (state.invite.trim()) body.invite = state.invite.trim();
  } else if (state.name.trim() !== experience.name) {
    body.name = state.name.trim();
  }
  // The image is the person's for a service only; emptying the field clears it. It never resets a verification.
  if (experience.kind === 'service') {
    const image = state.image_url.trim() || null;
    if (image !== (experience.image_url ?? null)) body.image_url = image;
  }
  if (state.position !== experience.position) body.position = state.position;
  const other = state.position === 'other' ? state.position_other.trim() : null;
  if (other !== null && (other !== (experience.position_other ?? '') || state.position !== experience.position)) {
    body.position_other = other;
  }
  const description = state.description.trim() || null;
  if (description !== (experience.description?.trim() || null)) body.description = description;
  if (state.start_date !== experience.start_date) body.start_date = state.start_date;
  const end = state.current ? null : state.end_date;
  if (end !== experience.end_date) body.end_date = end;
  return body;
}

export type ResetEffect = 'none' | 'resets' | 'keeps';

/**
 * What saving does to the verification. Sensitive: the server (a new invitation),
 * a service's name, the position, the dates. The description never matters.
 * Exception (§7): only an end date added to a verified, current experience keeps it.
 */
export function verificationEffect(experience: PrivateExperience, body: UpdateExperienceBody): ResetEffect {
  if (experience.verification.status === 'unverified') return 'none';
  const sensitive = (['invite', 'name', 'position', 'position_other', 'start_date', 'end_date'] as const).filter(
    (key) => body[key] !== undefined && (key === 'invite' || body[key] !== (experience[key] ?? null)),
  );
  if (sensitive.length === 0) return 'none';
  if (
    experience.verification.status === 'verified' &&
    experience.end_date === null &&
    sensitive.length === 1 &&
    sensitive[0] === 'end_date' &&
    typeof body.end_date === 'string'
  ) {
    return 'keeps';
  }
  return 'resets';
}

/** Which verification buttons the owner sees (LINEUP.md §13). */
export function verificationOffer(experience: PrivateExperience): {
  auto: boolean;
  review: boolean;
  pending: boolean;
  verified: boolean;
} {
  const {status} = experience.verification;
  const open = status === 'unverified' || status === 'rejected';
  return {
    auto: open && experience.kind === 'guild' && experience.is_current,
    review: open,
    pending: status === 'pending',
    verified: status === 'verified',
  };
}

/** `ids` moved: the item at `from` goes to `to`. */
export function move<T>(list: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return [...list];
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item as T);
  return next;
}
