/**
 * Request bodies of every write route, with the constraints of LINEUP.md §4
 * ("Autres limites") and §6. Shape errors are standard 422s; the business
 * rules that need the database (quota, ownership…) live in the logic modules.
 */

import {catalogFixture as catalog} from '@/api/catalog.fixture';

import {isCalendarDate} from '../time';
import {
  anyValue,
  BAD,
  type Bad,
  bool,
  type Field,
  type Issues,
  int,
  isRecord,
  isUuid,
  list,
  literal,
  type Loc,
  map,
  model,
  nullable,
  opt,
  type Parser,
  refine,
  req,
  str,
} from './validate';

export const limits = catalog.limits;

const POSITION_IDS: readonly string[] = catalog.positions.map((entry) => entry.id);
const THEME_IDS: readonly string[] = catalog.themes.map((entry) => entry.id);
const LANGUAGE_IDS: readonly string[] = catalog.languages.map((entry) => entry.id);
const COMPENSATION_IDS: readonly string[] = catalog.compensations.map((entry) => entry.id);

export const isPosition = (id: string) => POSITION_IDS.includes(id);
export const isTheme = (id: string) => THEME_IDS.includes(id);
export const isLanguage = (id: string) => LANGUAGE_IDS.includes(id);
export const isCompensation = (id: string) => COMPENSATION_IDS.includes(id);

// ---------------------------------------------------------------------------
// Reusable fields
// ---------------------------------------------------------------------------

/** https only, 500 characters at most, no credentials, no spaces, port 443 or none (§4). */
export function urlProblem(raw: string): string | null {
  if (raw.length > 500) return "L'URL ne doit pas dépasser 500 caractères.";
  if (/\s/.test(raw)) return "L'URL ne doit pas contenir d'espaces.";
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return "L'URL est invalide.";
  }
  if (url.protocol !== 'https:') return "L'URL doit commencer par https://.";
  if (url.username || url.password) return "L'URL ne doit pas contenir d'identifiants.";
  if (url.port && url.port !== '443') return "L'URL ne peut utiliser que le port 443.";
  if (!url.hostname.includes('.')) return "L'URL doit contenir un nom de domaine.";
  return null;
}

export const urlString: Parser<string> = refine(str({min: 1}), urlProblem);

/** An IANA zone or `UTC±HH:MM` (hours 00-14, minutes 00-59), 64 characters at most (§4). */
export function timezoneProblem(raw: string): string | null {
  if (raw.length > 64) return 'Le fuseau horaire ne doit pas dépasser 64 caractères.';
  const offset = /^UTC([+-])(\d{2}):(\d{2})$/.exec(raw);
  if (offset) {
    const hours = Number(offset[2]);
    const minutes = Number(offset[3]);
    return hours <= 14 && minutes <= 59 ? null : 'Le décalage UTC est invalide (heures 00 à 14, minutes 00 à 59).';
  }
  if (raw === 'UTC') return null;
  if (/^[A-Za-z]+(\/[A-Za-z0-9_+-]+)+$/.test(raw)) {
    try {
      new Intl.DateTimeFormat('en', {timeZone: raw});
      return null;
    } catch {
      // Falls through to the error.
    }
  }
  return 'Fuseau horaire inconnu (ex. Europe/Paris ou UTC+02:00).';
}

export const timezone: Parser<string> = refine(str({min: 1}), timezoneProblem);

export const link = model({label: req(str({min: 1, max: 40})), url: req(urlString)});
export const links = list(link, {max: limits.max_links});

const unique = <T>(values: T[]) => [...new Set(values)];

/** Lower-cased and trimmed by the API; must then match `^[a-z0-9-]{2,24}$`. */
export const tag: Parser<string> = refine(
  map(str(), (value) => value.toLowerCase()),
  (value) =>
    new RegExp(limits.tag_pattern).test(value)
      ? null
      : `Tag invalide : « ${value} » (minuscules, chiffres et tirets, 2 à 24 caractères).`,
);
export const tags = map(list(tag, {max: limits.max_tags}), unique);

const languageId: Parser<string> = refine(str(), (value) => (isLanguage(value) ? null : `Langue inconnue : ${value}.`));
export const languages = map(list(languageId, {max: limits.max_languages}), unique);

export const themeId: Parser<string> = refine(str(), (value) => (isTheme(value) ? null : `Thème inconnu : ${value}.`));

const positionId: Parser<string> = refine(str(), (value) => (isPosition(value) ? null : `Poste inconnu : ${value}.`));
export const positions = refine(list(positionId, {min: 1, max: limits.max_positions}), (value) =>
  new Set(value).size === value.length ? null : 'Les postes ne doivent pas contenir de doublons.',
);
export const positionsOther = list(str({min: 1, max: limits.position_other_max_len}), {
  max: limits.max_positions_other,
});

export const uuidString: Parser<string> = (value, loc, issues) => {
  const text = str()(value, loc, issues);
  if (text === BAD) return BAD;
  if (!isUuid(text)) {
    issues.add('uuid_parsing', loc, 'Input should be a valid UUID, invalid character', value, {
      error: 'invalid character',
    });
    return BAD;
  }
  return text.toLowerCase();
};

export const snowflakeString: Parser<string> = refine(str({min: 1}), (value) =>
  /^\d{1,19}$/.test(value) ? null : 'Identifiant Discord invalide.',
);

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

export const calendarDateField: Parser<string> = (value, loc, issues) => {
  if (typeof value !== 'string') {
    issues.add('date_type', loc, 'Input should be a valid date', value);
    return BAD;
  }
  if (!isCalendarDate(value)) {
    issues.add(
      'date_parsing',
      loc,
      'Input should be a valid date in the format YYYY-MM-DD, invalid character in year',
      value,
      {
        error: 'invalid character in year',
      },
    );
    return BAD;
  }
  return value;
};

const DATETIME = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(:\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/i;

/** An ISO datetime WITH a time zone, as a `Date`. */
export const awareDatetime: Parser<Date> = (value, loc, issues) => {
  if (typeof value !== 'string') {
    issues.add('datetime_type', loc, 'Input should be a valid datetime', value);
    return BAD;
  }
  const match = DATETIME.exec(value.trim());
  const date = match ? new Date(value.trim().replace(' ', 'T')) : null;
  if (!match || !date || Number.isNaN(date.getTime())) {
    issues.add(
      'datetime_from_date_parsing',
      loc,
      'Input should be a valid datetime or date, invalid datetime separator',
      value,
      {
        error: 'invalid datetime separator',
      },
    );
    return BAD;
  }
  if (!match[4]) {
    issues.add('timezone_aware', loc, 'Input should have timezone info', value);
    return BAD;
  }
  return date;
};

// ---------------------------------------------------------------------------
// Requirements and applications (§4, §6.4)
// ---------------------------------------------------------------------------

export interface ParsedRequirement {
  type: string;
  value: number | string | boolean | string[] | null;
  label: string | null;
  verified_by_lineup: boolean;
}

const requirementShape = model({
  type: req(str({min: 1})),
  value: opt(anyValue),
  label: opt(nullable(str())),
  verified_by_lineup: opt(bool),
});

/** A condition checked against its catalog entry: the shape of `value` follows `value_type`. */
export const requirement: Parser<ParsedRequirement> = (input, loc, issues) => {
  const shape = requirementShape(input, loc, issues);
  if (shape === BAD) return BAD;
  const entry = catalog.requirements.find((candidate) => candidate.id === shape.type);
  const fail = (path: Loc, message: string, raw: unknown): Bad => {
    issues.add('value_error', path, `Value error, ${message}`, raw, {error: {}});
    return BAD;
  };
  if (!entry) return fail([...loc, 'type'], `Type de condition inconnu : ${shape.type}.`, shape.type);

  const raw = shape.value ?? null;
  const valueLoc = [...loc, 'value'];
  let value: ParsedRequirement['value'] = null;
  switch (entry.value_type) {
    case 'int': {
      const min = 'min' in entry ? (entry.min ?? 0) : 0;
      const max = 'max' in entry ? (entry.max ?? 0) : 0;
      if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < min || raw > max) {
        return fail(valueLoc, `La valeur doit être un entier entre ${min} et ${max}.`, raw);
      }
      value = raw;
      break;
    }
    case 'text': {
      const max = 'max_len' in entry ? (entry.max_len ?? 200) : 200;
      const text = typeof raw === 'string' ? raw.trim() : '';
      if (text === '' || text.length > max)
        return fail(valueLoc, `La valeur doit être un texte de 1 à ${max} caractères.`, raw);
      value = text;
      break;
    }
    case 'bool':
      if (typeof raw !== 'boolean') return fail(valueLoc, 'La valeur doit être un booléen.', raw);
      value = raw;
      break;
    case 'languages': {
      const ids = Array.isArray(raw) ? raw : null;
      if (!ids || ids.length === 0 || !ids.every((id) => typeof id === 'string' && isLanguage(id))) {
        return fail(valueLoc, "La valeur doit être une liste non vide d'identifiants de langue.", raw);
      }
      value = unique(ids as string[]);
      break;
    }
    case 'none':
      if (raw !== null) return fail(valueLoc, 'Cette condition ne prend aucune valeur.', raw);
      break;
  }

  let label: string | null = null;
  if ('requires_label' in entry && entry.requires_label) {
    const max = 'label_max_len' in entry ? (entry.label_max_len ?? 80) : 80;
    const text = typeof shape.label === 'string' ? shape.label.trim() : '';
    if (text === '') return fail([...loc, 'label'], 'Cette condition exige un titre (label).', shape.label ?? null);
    if (text.length > max)
      return fail([...loc, 'label'], `Le titre ne doit pas dépasser ${max} caractères.`, shape.label);
    label = text;
  }

  // §4: "Vérifié par Lineup" only where Lineup can (or will be able to) check it.
  const verified = shape.verified_by_lineup ?? false;
  if (verified && entry.verifiable === 'no') {
    return fail([...loc, 'verified_by_lineup'], 'Cette condition ne peut pas être vérifiée par Lineup.', true);
  }
  return {type: entry.id, value, label, verified_by_lineup: verified};
};

export const requirements = list(requirement, {max: limits.max_requirements});

export interface ParsedApplication {
  type: 'external_url' | 'discord_dm' | 'lineup_form';
  url: string | null;
}

/**
 * `{type: external_url, url}` (https, required), `{type: discord_dm}` (no
 * `url` at all) or the reserved `lineup_form`, which parses here and is
 * refused by the logic with 422 `lineup_form_unavailable`.
 */
export const application: Parser<ParsedApplication> = (input, loc, issues) => {
  if (!isRecord(input)) {
    issues.add(
      'model_attributes_type',
      loc,
      'Input should be a valid dictionary or object to extract fields from',
      input,
    );
    return BAD;
  }
  const type = literal(['external_url', 'discord_dm', 'lineup_form'] as const)(input.type, [...loc, 'type'], issues);
  if (type === BAD) return BAD;
  if (!('type' in input)) {
    issues.add('missing', [...loc, 'type'], 'Field required', input);
    return BAD;
  }
  const allowed = type === 'external_url' ? ['type', 'url'] : ['type'];
  let bad = false;
  for (const key of Object.keys(input)) {
    if (!allowed.includes(key)) {
      issues.add('extra_forbidden', [...loc, key], 'Extra inputs are not permitted', input[key]);
      bad = true;
    }
  }
  if (type === 'external_url') {
    if (!('url' in input)) {
      issues.add('missing', [...loc, 'url'], 'Field required', input);
      return BAD;
    }
    const url = urlString(input.url, [...loc, 'url'], issues);
    return bad || url === BAD ? BAD : {type, url};
  }
  return bad ? BAD : {type, url: null};
};

export const commitment = model({
  hours_per_week: opt(nullable(int({ge: 1, le: 168}))),
  compensation: opt(
    nullable(refine(str(), (value) => (isCompensation(value) ? null : `Rémunération inconnue : ${value}.`))),
  ),
  openings: opt(nullable(int({ge: 1, le: 50}))),
});

/** Expiry bounds that are shape rules: a time zone, and at most 180 days ahead (§4). */
export function expiresAt(now: Date): Parser<Date> {
  return (value, loc, issues) => {
    const date = awareDatetime(value, loc, issues);
    if (date === BAD) return BAD;
    const limit = now.getTime() + limits.post_max_expiry_days * 24 * 3600 * 1000;
    if (date.getTime() > limit) {
      issues.add(
        'value_error',
        loc,
        `Value error, La date d'expiration ne peut pas dépasser ${limits.post_max_expiry_days} jours.`,
        value,
        {error: {}},
      );
      return BAD;
    }
    return date;
  };
}

// ---------------------------------------------------------------------------
// Posts
// ---------------------------------------------------------------------------

const title = str({min: limits.title.min, max: limits.title.max});
const description = str({min: limits.description.min, max: limits.description.max});

/** The fields a post is made of; create and patch differ by required/nullable (§6.4). */
function postContentFields(now: Date) {
  return {
    title: req(title),
    description: req(description),
    positions: req(positions),
    positions_other: opt(positionsOther),
    requirements: opt(requirements),
    application: opt(nullable(application)),
    languages: opt(languages),
    timezone: opt(nullable(timezone)),
    commitment: opt(nullable(commitment)),
    theme: opt(nullable(themeId)),
    tags: opt(tags),
    featured_experience_id: opt(nullable(uuidString)),
    expires_at: opt(nullable(expiresAt(now))),
  };
}

export function createPostBody(now: Date): Parser<CreatePostInput> {
  const shape = model({
    kind: req(literal(['guild', 'user'] as const)),
    guild_id: opt(snowflakeString),
    ...postContentFields(now),
    status: opt(literal(['draft', 'published'] as const)),
  });
  return (value, loc, issues) => {
    const parsed = shape(value, loc, issues);
    if (parsed === BAD) return BAD;
    const rule = (field: string, message: string, raw: unknown) => {
      issues.add('value_error', [...loc, field], `Value error, ${message}`, raw, {error: {}});
    };
    let bad = false;
    if (parsed.kind === 'guild' && parsed.guild_id === undefined) {
      rule('guild_id', 'guild_id est obligatoire pour une annonce de serveur.', null);
      bad = true;
    }
    if (parsed.kind === 'user' && parsed.guild_id !== undefined) {
      rule('guild_id', 'guild_id est interdit pour une annonce personnelle.', parsed.guild_id);
      bad = true;
    }
    if (parsed.kind === 'guild' && parsed.featured_experience_id) {
      rule(
        'featured_experience_id',
        'Une annonce de serveur ne peut pas mettre en avant une expérience.',
        parsed.featured_experience_id,
      );
      bad = true;
    }
    // §6.4: `other` ↔ positions_other, on the body itself, is a standard 422 at creation.
    const hasOther = parsed.positions.includes('other');
    const others = parsed.positions_other ?? [];
    if (hasOther && others.length === 0) {
      rule(
        'positions_other',
        'positions_other est obligatoire quand « other » fait partie des postes.',
        parsed.positions_other ?? null,
      );
      bad = true;
    } else if (!hasOther && others.length > 0) {
      rule(
        'positions_other',
        "positions_other n'est autorisé que si « other » fait partie des postes.",
        parsed.positions_other,
      );
      bad = true;
    }
    return bad ? BAD : parsed;
  };
}

export type CreatePostInput = {
  kind: 'guild' | 'user';
  guild_id?: string;
  title: string;
  description: string;
  positions: string[];
  positions_other?: string[];
  requirements?: ParsedRequirement[];
  application?: ParsedApplication | null;
  languages?: string[];
  timezone?: string | null;
  commitment?: {hours_per_week?: number | null; compensation?: string | null; openings?: number | null} | null;
  theme?: string | null;
  tags?: string[];
  featured_experience_id?: string | null;
  expires_at?: Date | null;
  status?: 'draft' | 'published';
};

/** Every field optional; `kind`, `guild_id` and `status` are refused (`extra_forbidden`). */
export function updatePostBody(now: Date) {
  const fields = postContentFields(now);
  return model({
    title: opt(title),
    description: opt(description),
    positions: opt(positions),
    positions_other: opt(positionsOther),
    requirements: opt(requirements),
    application: fields.application,
    languages: opt(languages),
    timezone: fields.timezone,
    commitment: fields.commitment,
    theme: fields.theme,
    tags: opt(tags),
    featured_experience_id: fields.featured_experience_id,
    expires_at: fields.expires_at,
  });
}

// ---------------------------------------------------------------------------
// Servers, profiles, experiences, reports, staff
// ---------------------------------------------------------------------------

export const claimBody = model({invite: req(str({min: 2, max: 200}))});

export const guildUpdateBody = model({
  description: opt(nullable(str({max: 2000}))),
  links: opt(links),
  theme: opt(nullable(themeId)),
  tags: opt(tags),
  languages: opt(languages),
  // `null` is accepted and ignored (§6.2).
  invite: opt(nullable(str({min: 2, max: 200}))),
  listed: opt(bool),
});

export const profileUpdateBody = model({
  headline: opt(nullable(str({max: 120}))),
  bio: opt(nullable(str({max: 2000}))),
  links: opt(links),
  languages: opt(languages),
  timezone: opt(nullable(timezone)),
  open_to_work: opt(bool),
});

const experiencePosition: Parser<string> = refine(str({min: 1}), (value) =>
  isPosition(value) ? null : `Poste inconnu : ${value}.`,
);
const experienceName = str({min: 1, max: 100});
const positionOther = str({min: 1, max: limits.position_other_max_len});
const experienceDescription = nullable(str({max: 1000}));

export type CreateExperienceInput = {
  kind: 'guild' | 'service';
  invite?: string;
  name?: string;
  position: string;
  position_other?: string;
  description?: string | null;
  start_date: string;
  end_date?: string | null;
};

export function createExperienceBody(today: string): Parser<CreateExperienceInput> {
  const dateNotFuture: Parser<string> = refine(calendarDateField, (value) =>
    value > today ? 'La date ne peut pas être dans le futur.' : null,
  );
  const shape = model({
    kind: req(literal(['guild', 'service'] as const)),
    invite: opt(str({min: 2, max: 200})),
    name: opt(experienceName),
    position: req(experiencePosition),
    position_other: opt(positionOther),
    description: opt(experienceDescription),
    start_date: req(dateNotFuture),
    end_date: opt(nullable(dateNotFuture)),
  });
  return (value, loc, issues) => {
    const parsed = shape(value, loc, issues);
    if (parsed === BAD) return BAD;
    const rule = (field: string, message: string, raw: unknown) => {
      issues.add('value_error', [...loc, field], `Value error, ${message}`, raw, {error: {}});
    };
    let bad = false;
    if (parsed.kind === 'guild' && parsed.invite === undefined) {
      issues.add('missing', [...loc, 'invite'], 'Field required', value);
      bad = true;
    }
    if (parsed.kind === 'service') {
      if (parsed.name === undefined) {
        issues.add('missing', [...loc, 'name'], 'Field required', value);
        bad = true;
      }
      if (parsed.invite !== undefined) {
        rule('invite', 'invite est interdit pour une expérience de type service.', parsed.invite);
        bad = true;
      }
    }
    if (parsed.position === 'other' && !parsed.position_other) {
      rule('position_other', 'position_other est obligatoire quand le poste est « other ».', null);
      bad = true;
    } else if (parsed.position !== 'other' && parsed.position_other !== undefined) {
      rule('position_other', "position_other n'est autorisé que pour le poste « other ».", parsed.position_other);
      bad = true;
    }
    if (parsed.end_date && parsed.end_date < parsed.start_date) {
      rule('end_date', 'La date de fin ne peut pas précéder la date de début.', parsed.end_date);
      bad = true;
    }
    return bad ? BAD : parsed;
  };
}

/** The merged state is checked by the logic (422 `lineup_experience_invalid`); here only the shapes. */
export const updateExperienceBody = model({
  invite: opt(str({min: 2, max: 200})),
  name: opt(experienceName),
  position: opt(experiencePosition),
  position_other: opt(positionOther),
  description: opt(experienceDescription),
  start_date: opt(calendarDateField),
  end_date: opt(nullable(calendarDateField)),
});

export const orderBody = model({ids: req(list(uuidString))});

export const noteBody = (max: number) => model({note: opt(str({max}))});

export const reportBody = model({
  target_type: req(literal(['post', 'user', 'guild'] as const)),
  target_id: req(str({min: 1, max: 64})),
  reason: req(literal(['spam', 'scam', 'inappropriate', 'impersonation', 'other'] as const)),
  details: opt(str({max: 1000})),
});

export const reasonBody = model({reason: req(str({min: 1, max: 500}))});

export type {Field, Issues};
