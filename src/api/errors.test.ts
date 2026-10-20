import {createInstance} from 'i18next';
import {beforeAll, describe, expect, it} from 'vitest';

import {LANGUAGE_CODES, type Language} from '@/i18n/languages';
import {resources} from '@/i18n/resources';

import lineupDoc from '../../LINEUP.md?raw';

import {ApiError, errorFromResponse} from './client';
import {ERROR_CODES, errorMessage, type ErrorsT, fieldErrors, formatWait, isKnownErrorCode} from './errors';

const instances = new Map<Language, ErrorsT>();

beforeAll(async () => {
  for (const lng of LANGUAGE_CODES) {
    const i18n = createInstance();
    await i18n.init({lng, resources, fallbackLng: false, ns: ['errors'], defaultNS: 'errors', initAsync: false});
    instances.set(lng, i18n.getFixedT(lng, 'errors') as ErrorsT);
  }
});

const tIn = (lng: Language) => instances.get(lng)!;
const lineupError = (code: string, status = 400, context: Record<string, unknown> = {}) =>
  errorFromResponse(status, {error: {code, message: 'Message du serveur.', ...context}}, null);

describe('ERROR_CODES', () => {
  it('lists every code of the table in LINEUP.md §12', () => {
    const doc = lineupDoc;
    const section = doc.slice(doc.indexOf('## 12. Codes d'), doc.indexOf('## 13.'));
    const documented = [...section.matchAll(/^\| \d{3} \| `([a-z_]+)`/gm)].map((match) => match[1]!);
    expect(documented.length).toBeGreaterThan(40);
    for (const code of documented) expect(ERROR_CODES, code).toContain(code);
    // user_suspended / guild_suspended share a row.
    expect(ERROR_CODES).toContain('guild_suspended');
  });

  it('has no duplicate', () => {
    expect(new Set(ERROR_CODES).size).toBe(ERROR_CODES.length);
  });

  for (const lng of LANGUAGE_CODES) {
    it(`has a message for every code in ${lng}, and no orphan message`, () => {
      const codes = (resources[lng].errors as {codes: Record<string, string>}).codes;
      for (const code of ERROR_CODES) {
        expect(typeof codes[code], `${lng}.${code}`).toBe('string');
        expect(codes[code]!.trim(), `${lng}.${code}`).not.toBe('');
      }
      expect(Object.keys(codes).sort()).toEqual([...ERROR_CODES].sort());
    });

    it(`gives a sentence for every code in ${lng} through errorMessage`, () => {
      for (const code of ERROR_CODES) {
        const message = errorMessage(lineupError(code), tIn(lng));
        expect(message.trim(), `${lng}.${code}`).not.toBe('');
        expect(message, `${lng}.${code}`).not.toMatch(/^codes\.|^errors:/);
      }
    });
  }

  it('knows its own codes', () => {
    expect(isKnownErrorCode('lineup_post_hidden')).toBe(true);
    expect(isKnownErrorCode('nope')).toBe(false);
    expect(isKnownErrorCode(null)).toBe(false);
  });
});

describe('errorMessage', () => {
  const fr = () => tIn('fr');
  const en = () => tIn('en');

  it('says the session expired, or that a sign-in is needed', () => {
    expect(errorMessage(errorFromResponse(401, {error: 'Session expiree'}, null), fr())).toBe(
      'Votre session a expiré. Connectez-vous de nouveau.',
    );
    expect(errorMessage(errorFromResponse(401, {error: 'Non authentifie'}, null), fr())).toBe(
      'Connectez-vous pour continuer.',
    );
  });

  it('uses the limit and the scope of a quota error', () => {
    const guild = lineupError('lineup_quota_exceeded', 409, {limit: 5, scope: 'guild'});
    const user = lineupError('lineup_quota_exceeded', 409, {limit: 3, scope: 'user'});
    expect(errorMessage(guild, fr())).toContain('5 annonces publiées sur ce serveur');
    expect(errorMessage(user, fr())).toContain('3 annonces publiées.');
    expect(errorMessage(user, en())).toContain('3 published posts');
    expect(errorMessage(lineupError('lineup_quota_exceeded', 409), fr())).toBe(
      "Vous avez atteint la limite d'annonces publiées.",
    );
  });

  it('words a refused management differently where it happened', () => {
    const error = lineupError('lineup_guild_forbidden', 403);
    expect(errorMessage(error, fr(), {context: 'claim'})).toContain('propriétaire');
    expect(errorMessage(error, fr(), {context: 'manage'})).toBe('Vous ne gérez plus ce serveur.');
    expect(errorMessage(error, fr())).toBe('Vous ne gérez pas ce serveur.');
  });

  it('names the state of a post that cannot make the transition', () => {
    const error = lineupError('lineup_post_invalid_status', 409, {current_status: 'published'});
    expect(errorMessage(error, fr())).toBe('Cette annonce est déjà publiée.');
    expect(errorMessage(lineupError('lineup_post_invalid_status', 409, {current_status: '???'}), fr())).toBe(
      "Cette action n'est pas possible pour l'état actuel de l'annonce.",
    );
  });

  it('gives the reason of a failed verification and of an inapplicable one', () => {
    expect(
      errorMessage(
        lineupError('lineup_verification_failed', 422, {reason: 'not_member', can_request_review: true}),
        fr(),
      ),
    ).toContain("n'êtes pas membre");
    expect(
      errorMessage(lineupError('lineup_verification_failed', 422, {reason: 'no_staff_permission'}), fr()),
    ).toContain('sans permission de staff');
    expect(errorMessage(lineupError('lineup_verification_not_applicable', 422, {reason: 'ended'}), fr())).toContain(
      'en cours',
    );
    expect(errorMessage(lineupError('lineup_verification_not_applicable', 422, {reason: 'not_guild'}), fr())).toContain(
      'serveurs Discord',
    );
  });

  it('says how long to wait on a rate limit, never as an outright refusal', () => {
    const limited = errorFromResponse(429, {error: {code: 'lineup_rate_limited', message: 'm', retry_after: 45}}, null);
    expect(errorMessage(limited, fr())).toBe('Trop de tentatives. Réessayez dans 45 secondes.');
    expect(errorMessage(limited, en())).toBe('Too many attempts. Try again in 45 seconds.');
    const hour = errorFromResponse(429, {error: {code: 'lineup_rate_limited', message: 'm', retry_after: 3000}}, null);
    expect(errorMessage(hour, fr())).toBe('Trop de tentatives. Réessayez dans 50 minutes.');
  });

  it('follows a countdown and says when the wait is over', () => {
    const limited = errorFromResponse(429, {error: {code: 'lineup_rate_limited', message: 'm', retry_after: 60}}, null);
    expect(errorMessage(limited, fr(), {seconds: 12})).toBe('Trop de tentatives. Réessayez dans 12 secondes.');
    expect(errorMessage(limited, fr(), {seconds: 0})).toBe('Vous pouvez réessayer.');
  });

  it('phrases a Discord outage as a wait, with the delay', () => {
    const outage = errorFromResponse(503, {error: {code: 'discord_unavailable', message: 'm'}}, '30');
    expect(errorMessage(outage, fr())).toBe('Discord ne répond pas pour le moment. Réessayez dans 30 secondes.');
    expect(errorMessage(outage, fr())).not.toMatch(/refus|interdit|impossible/i);
    expect(errorMessage(outage, tIn('de'))).toBe(
      'Discord antwortet gerade nicht. Versuchen Sie es in 30 Sekunden erneut.',
    );
  });

  it('answers a network failure', () => {
    const offline = new ApiError({status: 0, kind: 'network', code: 'network_error'});
    expect(errorMessage(offline, fr())).toBe('Connexion impossible. Vérifiez votre réseau.');
  });

  it('shows the API message for a code it does not know, else a generic sentence', () => {
    expect(errorMessage(lineupError('lineup_something_new'), fr())).toBe('Message du serveur.');
    expect(errorMessage(new ApiError({status: 400, kind: 'unknown', code: null}), fr())).toBe(
      'Une erreur est survenue. Réessayez.',
    );
    expect(errorMessage(new ApiError({status: 502, kind: 'unknown', code: null}), fr())).toBe(
      'Le serveur a rencontré une erreur. Réessayez dans un instant.',
    );
    expect(errorMessage(new Error('boom'), fr())).toBe('Une erreur est survenue. Réessayez.');
    expect(errorMessage('boom', fr())).toBe('Une erreur est survenue. Réessayez.');
  });

  it('formats the wait in the unit that reads best', () => {
    expect(formatWait(1, fr())).toBe('1 seconde');
    expect(formatWait(59, fr())).toBe('59 secondes');
    expect(formatWait(60, fr())).toBe('1 minute');
    expect(formatWait(61, fr())).toBe('2 minutes');
    expect(formatWait(3600, fr())).toBe('1 heure');
    expect(formatWait(0, fr())).toBe('1 seconde');
  });
});

describe('fieldErrors', () => {
  const validation = (detail: unknown[]) => errorFromResponse(422, {error: 'Validation error', detail}, null);

  it('maps fields to translated messages, with their limits', () => {
    const error = validation([
      {
        type: 'string_too_short',
        loc: ['body', 'title'],
        msg: 'String should have at least 5 characters',
        ctx: {min_length: 5},
      },
      {type: 'string_too_long', loc: ['body', 'description'], msg: 'x', ctx: {max_length: 4000}},
      {type: 'missing', loc: ['body', 'positions'], msg: 'Field required'},
      {type: 'too_long', loc: ['body', 'tags'], msg: 'x', ctx: {max_length: 10}},
      {type: 'greater_than_equal', loc: ['body', 'requirements', 0, 'value'], msg: 'x', ctx: {ge: 13}},
      {type: 'less_than_equal', loc: ['query', 'limit'], msg: 'x', ctx: {le: 50}},
    ]);
    expect(fieldErrors(error, tIn('fr'))).toEqual({
      title: '5 caractères au minimum.',
      description: '4000 caractères au maximum.',
      positions: 'Ce champ est obligatoire.',
      tags: '10 éléments au maximum.',
      'requirements.0.value': "La valeur doit être d'au moins 13.",
      limit: "La valeur doit être d'au plus 50.",
    });
    expect(fieldErrors(error, tIn('en')).title).toBe('At least 5 characters.');
  });

  it('keeps the first message of a field', () => {
    const error = validation([
      {type: 'missing', loc: ['body', 'title'], msg: 'Field required'},
      {type: 'string_too_short', loc: ['body', 'title'], msg: 'x', ctx: {min_length: 5}},
    ]);
    expect(fieldErrors(error, tIn('fr'))).toEqual({title: 'Ce champ est obligatoire.'});
  });

  it('translates numbers, urls, dates, ids and extra fields', () => {
    const error = validation([
      {type: 'int_parsing', loc: ['body', 'commitment', 'hours_per_week'], msg: 'x'},
      {type: 'url_scheme', loc: ['body', 'application', 'url'], msg: 'x'},
      {type: 'url_parsing', loc: ['body', 'links', 0, 'url'], msg: 'x'},
      {type: 'datetime_parsing', loc: ['body', 'expires_at'], msg: 'x'},
      {type: 'uuid_parsing', loc: ['path', 'post_id'], msg: 'x'},
      {type: 'extra_forbidden', loc: ['body', 'nope'], msg: 'x'},
    ]);
    expect(fieldErrors(error, tIn('fr'))).toEqual({
      'commitment.hours_per_week': 'Saisissez un nombre entier.',
      'application.url': "L'adresse doit commencer par https://.",
      'links.0.url': 'Saisissez une adresse web valide.',
      expires_at: 'Saisissez une date valide.',
      post_id: "Cet identifiant n'est pas valide.",
      nope: "Ce champ n'est pas accepté.",
    });
  });

  it("shows the API's own message for Lineup's rules (value_error), without Pydantic's prefix", () => {
    const error = validation([
      {type: 'value_error', loc: ['body', 'tags', 1], msg: 'Value error, Tag invalide : « Café ».'},
    ]);
    expect(fieldErrors(error, tIn('fr'))).toEqual({'tags.1': 'Tag invalide : « Café ».'});
  });

  it('keeps the API message for a type it does not know, and falls back when a limit is missing', () => {
    const error = validation([
      {type: 'something_new', loc: ['body', 'a'], msg: 'Weird thing'},
      {type: 'string_too_short', loc: ['body', 'b'], msg: 'Too short'},
    ]);
    expect(fieldErrors(error, tIn('fr'))).toEqual({a: 'Weird thing', b: 'Too short'});
  });

  it('keys a model-level issue under _form', () => {
    expect(
      fieldErrors(validation([{type: 'value_error', loc: ['body'], msg: 'Value error, Incohérent.'}]), tIn('fr')),
    ).toEqual({
      _form: 'Incohérent.',
    });
  });

  it('is empty for anything but a 422', () => {
    expect(fieldErrors(lineupError('cursor_invalid', 422), tIn('fr'))).toEqual({});
    expect(fieldErrors(new Error('x'), tIn('fr'))).toEqual({});
  });
});
