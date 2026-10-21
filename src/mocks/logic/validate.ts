/**
 * A tiny validation toolkit that produces Pydantic-style issues, the way the
 * real API's standard 422 does (LINEUP.md §0, form 4):
 *
 *   {type, loc: ['body', 'title'], msg: 'String should have at least 5 characters', input, ctx}
 *
 * Parsers collect issues instead of throwing, so one request reports every
 * problem at once, in field order, like FastAPI.
 */

import type {ValidationIssue} from '@/api/types';

import {validationFailure} from '../errors';

export type Loc = Array<string | number>;

/** Returned by a parser that reported at least one issue. */
export const BAD = Symbol('bad');
export type Bad = typeof BAD;

export class Issues {
  readonly list: ValidationIssue[] = [];

  add(type: string, loc: Loc, msg: string, input?: unknown, ctx?: Record<string, unknown>): void {
    const issue: ValidationIssue = {type, loc: [...loc], msg};
    if (input !== undefined) issue.input = input;
    else issue.input = null;
    if (ctx) issue.ctx = ctx;
    this.list.push(issue);
  }

  get ok(): boolean {
    return this.list.length === 0;
  }

  /** Throws the standard 422 if anything was reported. */
  throwIfAny(): void {
    if (this.list.length > 0) throw validationFailure(this.list);
  }
}

export type Parser<T> = (value: unknown, loc: Loc, issues: Issues) => T | Bad;

export interface Field<T, R extends boolean = boolean> {
  parse: Parser<T>;
  required: R;
}

export const req = <T>(parse: Parser<T>): Field<T, true> => ({parse, required: true});
export const opt = <T>(parse: Parser<T>): Field<T, false> => ({parse, required: false});

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

// ---------------------------------------------------------------------------
// Scalars
// ---------------------------------------------------------------------------

export function str(options: {min?: number; max?: number; strip?: boolean} = {}): Parser<string> {
  const {min, max, strip = true} = options;
  return (value, loc, issues) => {
    if (typeof value !== 'string') {
      issues.add('string_type', loc, 'Input should be a valid string', value);
      return BAD;
    }
    const text = strip ? value.trim() : value;
    if (min !== undefined && text.length < min) {
      issues.add('string_too_short', loc, `String should have at least ${plural(min, 'character')}`, value, {
        min_length: min,
      });
      return BAD;
    }
    if (max !== undefined && text.length > max) {
      issues.add('string_too_long', loc, `String should have at most ${plural(max, 'character')}`, value, {
        max_length: max,
      });
      return BAD;
    }
    return text;
  };
}

export function int(options: {ge?: number; le?: number} = {}): Parser<number> {
  return (value, loc, issues) => {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      issues.add('int_type', loc, 'Input should be a valid integer', value);
      return BAD;
    }
    if (!Number.isInteger(value)) {
      issues.add('int_from_float', loc, 'Input should be a valid integer, got a number with a fractional part', value);
      return BAD;
    }
    if (options.ge !== undefined && value < options.ge) {
      issues.add('greater_than_equal', loc, `Input should be greater than or equal to ${options.ge}`, value, {
        ge: options.ge,
      });
      return BAD;
    }
    if (options.le !== undefined && value > options.le) {
      issues.add('less_than_equal', loc, `Input should be less than or equal to ${options.le}`, value, {
        le: options.le,
      });
      return BAD;
    }
    return value;
  };
}

export const bool: Parser<boolean> = (value, loc, issues) => {
  if (typeof value !== 'boolean') {
    issues.add('bool_type', loc, 'Input should be a valid boolean', value);
    return BAD;
  }
  return value;
};

/** A value that can be any JSON (the `value` of a requirement, checked later against the catalog). */
export const anyValue: Parser<unknown> = (value) => value;

export function literal<const V extends string>(values: readonly V[]): Parser<V> {
  const expected =
    values.length === 1
      ? `'${values[0]}'`
      : `${values
          .slice(0, -1)
          .map((v) => `'${v}'`)
          .join(', ')} or '${values[values.length - 1]}'`;
  return (value, loc, issues) => {
    if (typeof value === 'string' && (values as readonly string[]).includes(value)) return value as V;
    issues.add('literal_error', loc, `Input should be ${expected}`, value, {expected});
    return BAD;
  };
}

/** `null` is a value: used where the API accepts an explicit null ("clear it"). */
export function nullable<T>(parse: Parser<T>): Parser<T | null> {
  return (value, loc, issues) => (value === null ? null : parse(value, loc, issues));
}

/**
 * A rule of Lineup's own (a URL, a tag, a catalog id…): Pydantic reports a
 * `value_error` whose message is "Value error, " + the French text.
 */
export function refine<T>(parse: Parser<T>, check: (value: T) => string | null): Parser<T> {
  return (value, loc, issues) => {
    const parsed = parse(value, loc, issues);
    if (parsed === BAD) return BAD;
    const message = check(parsed);
    if (message === null) return parsed;
    issues.add('value_error', loc, `Value error, ${message}`, value, {error: {}});
    return BAD;
  };
}

/** Transforms a parsed value (lower-casing tags…). */
export function map<T, U>(parse: Parser<T>, fn: (value: T) => U): Parser<U> {
  return (value, loc, issues) => {
    const parsed = parse(value, loc, issues);
    return parsed === BAD ? BAD : fn(parsed);
  };
}

export function list<T>(item: Parser<T>, options: {min?: number; max?: number} = {}): Parser<T[]> {
  return (value, loc, issues) => {
    if (!Array.isArray(value)) {
      issues.add('list_type', loc, 'Input should be a valid list', value);
      return BAD;
    }
    const out: T[] = [];
    let bad = false;
    value.forEach((entry, index) => {
      const parsed = item(entry, [...loc, index], issues);
      if (parsed === BAD) bad = true;
      else out.push(parsed);
    });
    if (bad) return BAD;
    if (options.min !== undefined && out.length < options.min) {
      issues.add(
        'too_short',
        loc,
        `List should have at least ${plural(options.min, 'item')} after validation, not ${out.length}`,
        value,
        {field_type: 'List', min_length: options.min, actual_length: out.length},
      );
      return BAD;
    }
    if (options.max !== undefined && out.length > options.max) {
      issues.add(
        'too_long',
        loc,
        `List should have at most ${plural(options.max, 'item')} after validation, not ${out.length}`,
        value,
        {field_type: 'List', max_length: options.max, actual_length: out.length},
      );
      return BAD;
    }
    return out;
  };
}

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

type AnyField = Field<unknown, boolean>;

type ModelOutput<F extends Record<string, AnyField>> = {
  [K in keyof F as F[K]['required'] extends true ? K : never]: F[K] extends Field<infer T, boolean> ? T : never;
} & {
  [K in keyof F as F[K]['required'] extends false ? K : never]?: F[K] extends Field<infer T, boolean> ? T : never;
};

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * An object with known fields. Unknown keys are refused (`extra_forbidden`,
 * LINEUP.md §0), a missing required key is `missing`, and only the keys that
 * were SENT are in the result (an absent key means "do not touch").
 */
export function model<F extends Record<string, AnyField>>(fields: F): Parser<ModelOutput<F>> {
  return (value, loc, issues) => {
    if (!isRecord(value)) {
      issues.add(
        'model_attributes_type',
        loc,
        'Input should be a valid dictionary or object to extract fields from',
        value,
      );
      return BAD;
    }
    const out: Record<string, unknown> = {};
    let bad = false;
    for (const key of Object.keys(value)) {
      if (!(key in fields)) {
        issues.add('extra_forbidden', [...loc, key], 'Extra inputs are not permitted', value[key]);
        bad = true;
      }
    }
    for (const [key, field] of Object.entries(fields)) {
      if (!(key in value)) {
        if (field.required) {
          issues.add('missing', [...loc, key], 'Field required', value);
          bad = true;
        }
        continue;
      }
      const parsed = field.parse(value[key], [...loc, key], issues);
      if (parsed === BAD) bad = true;
      else out[key] = parsed;
    }
    return bad ? BAD : (out as ModelOutput<F>);
  };
}

// ---------------------------------------------------------------------------
// Request bodies, paths and queries
// ---------------------------------------------------------------------------

/**
 * Parses a request body with `parser`. A body that is not JSON is
 * `json_invalid`; a missing body is `missing` when the route needs one and `{}`
 * when it is optional (`{note}` bodies, LINEUP.md §6.6).
 */
export function parseBody<T>(raw: string | undefined, parser: Parser<T>, options: {required?: boolean} = {}): T {
  const issues = new Issues();
  const text = raw?.trim() ?? '';
  let json: unknown;
  if (text === '') {
    if (options.required) {
      issues.add('missing', ['body'], 'Field required', null);
      issues.throwIfAny();
    }
    json = {};
  } else {
    try {
      json = JSON.parse(text);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid JSON';
      const position = Number(/position (\d+)/.exec(message)?.[1] ?? 0);
      issues.add('json_invalid', ['body', position], 'JSON decode error', {}, {error: message});
      issues.throwIfAny();
    }
  }
  const parsed = parser(json, ['body'], issues);
  issues.throwIfAny();
  return parsed as T;
}

/** FastAPI's UUID parsing error text, close enough to be believable. */
function uuidProblem(raw: string): string | null {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)) return null;
  const bad = /[^0-9a-fA-F-]/.exec(raw);
  if (bad) {
    return `invalid character: expected an optional prefix of \`urn:uuid:\` followed by [0-9a-fA-F-], found \`${bad[0]}\` at ${bad.index + 1}`;
  }
  const digits = raw.replace(/-/g, '').length;
  return digits === 32
    ? 'invalid group count: expected 5, found ' + raw.split('-').length
    : `invalid length: expected length 32 for simple format, found ${digits}`;
}

export const isUuid = (raw: string): boolean => uuidProblem(raw) === null;

/** The path/query/body helpers read from one place and report in one `Issues`. */
export class Params {
  constructor(
    private readonly where: 'path' | 'query',
    private readonly source: URLSearchParams | Record<string, string>,
    readonly issues: Issues,
  ) {}

  private raw(name: string): string | undefined {
    if (this.source instanceof URLSearchParams) return this.source.get(name) ?? undefined;
    return this.source[name];
  }

  private all(name: string): string[] {
    return this.source instanceof URLSearchParams ? this.source.getAll(name) : [this.source[name] ?? ''];
  }

  /** An integer, with Pydantic's parsing and bound errors. */
  int(name: string, options: {def?: number; ge?: number; le?: number; required?: boolean} = {}): number | undefined {
    const raw = this.raw(name);
    const loc = [this.where, name];
    if (raw === undefined) {
      if (options.required) this.issues.add('missing', loc, 'Field required', null);
      return options.def;
    }
    if (!/^[+-]?\d+$/.test(raw.trim())) {
      this.issues.add('int_parsing', loc, 'Input should be a valid integer, unable to parse string as an integer', raw);
      return options.def;
    }
    const value = Number(raw);
    if (options.ge !== undefined && value < options.ge) {
      this.issues.add('greater_than_equal', loc, `Input should be greater than or equal to ${options.ge}`, raw, {
        ge: options.ge,
      });
      return options.def;
    }
    if (options.le !== undefined && value > options.le) {
      this.issues.add('less_than_equal', loc, `Input should be less than or equal to ${options.le}`, raw, {
        le: options.le,
      });
      return options.def;
    }
    return value;
  }

  /** A path id that must be an integer; returned as the original digits (snowflakes overflow Number). */
  snowflake(name: string): string {
    const raw = this.raw(name) ?? '';
    if (!/^[+-]?\d+$/.test(raw)) {
      this.issues.add(
        'int_parsing',
        [this.where, name],
        'Input should be a valid integer, unable to parse string as an integer',
        raw,
      );
      return '0';
    }
    return String(BigInt(raw));
  }

  uuid(name: string): string {
    const raw = this.raw(name) ?? '';
    const problem = uuidProblem(raw);
    if (problem) {
      this.issues.add('uuid_parsing', [this.where, name], `Input should be a valid UUID, ${problem}`, raw, {
        error: problem,
      });
    }
    return raw.toLowerCase();
  }

  string(name: string, options: {max?: number; pattern?: RegExp; required?: boolean} = {}): string | undefined {
    const raw = this.raw(name);
    const loc = [this.where, name];
    if (raw === undefined) {
      if (options.required) this.issues.add('missing', loc, 'Field required', null);
      return undefined;
    }
    if (options.max !== undefined && raw.length > options.max) {
      this.issues.add('string_too_long', loc, `String should have at most ${plural(options.max, 'character')}`, raw, {
        max_length: options.max,
      });
      return undefined;
    }
    if (options.pattern && !options.pattern.test(raw)) {
      this.issues.add('string_pattern_mismatch', loc, `String should match pattern '${options.pattern.source}'`, raw, {
        pattern: options.pattern.source,
      });
      return undefined;
    }
    return raw;
  }

  /** Pydantic accepts true/false, 1/0, yes/no, on/off, t/f, y/n. */
  bool(name: string, def = false): boolean {
    const raw = this.raw(name);
    if (raw === undefined) return def;
    const text = raw.trim().toLowerCase();
    if (['true', '1', 'yes', 'on', 't', 'y'].includes(text)) return true;
    if (['false', '0', 'no', 'off', 'f', 'n'].includes(text)) return false;
    this.issues.add(
      'bool_parsing',
      [this.where, name],
      'Input should be a valid boolean, unable to interpret input',
      raw,
    );
    return def;
  }

  /** `?positions=a&positions=b` and `?positions=a,b` both work; empty entries are dropped. */
  strings(name: string): string[] {
    return this.all(name)
      .flatMap((value) => value.split(','))
      .map((value) => value.trim())
      .filter((value) => value !== '');
  }

  has(name: string): boolean {
    return this.raw(name) !== undefined;
  }

  get(name: string): string | undefined {
    return this.raw(name);
  }
}
