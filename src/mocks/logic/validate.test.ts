import {describe, expect, it} from 'vitest';

import {
  application,
  awareDatetime,
  commitment,
  createPostBody,
  requirement,
  tag,
  timezoneProblem,
  urlProblem,
} from './schemas';
import {BAD, Issues, list, literal, model, nullable, opt, parseBody, Params, req, str, int} from './validate';
import {ApiFailure} from '../errors';

const NOW = new Date('2026-10-20T14:00:00.000Z');

function failure(run: () => unknown): ApiFailure {
  try {
    run();
  } catch (error) {
    if (error instanceof ApiFailure) return error;
    throw error;
  }
  throw new Error('did not throw');
}

describe('Pydantic-style issues', () => {
  it('reports a string that is too short with its ctx', () => {
    const issues = new Issues();
    expect(str({min: 5})('Hey', ['body', 'title'], issues)).toBe(BAD);
    expect(issues.list).toEqual([
      {
        type: 'string_too_short',
        loc: ['body', 'title'],
        msg: 'String should have at least 5 characters',
        input: 'Hey',
        ctx: {min_length: 5},
      },
    ]);
  });

  it('refuses unknown fields and reports missing ones', () => {
    const parser = model({title: req(str()), note: opt(str())});
    const issues = new Issues();
    expect(parser({typo: 1}, ['body'], issues)).toBe(BAD);
    expect(issues.list.map((issue) => [issue.type, issue.loc, issue.msg])).toEqual([
      ['extra_forbidden', ['body', 'typo'], 'Extra inputs are not permitted'],
      ['missing', ['body', 'title'], 'Field required'],
    ]);
  });

  it('keeps only the keys that were sent, and null only where allowed', () => {
    const parser = model({a: opt(nullable(str())), b: opt(str())});
    const ok = new Issues();
    expect(parser({a: null}, ['body'], ok)).toEqual({a: null});
    const bad = new Issues();
    parser({b: null}, ['body'], bad);
    expect(bad.list[0]?.type).toBe('string_type');
  });

  it('checks list sizes like Pydantic', () => {
    const issues = new Issues();
    list(str(), {min: 1, max: 2})([], ['body', 'positions'], issues);
    list(str(), {min: 1, max: 2})(['a', 'b', 'c'], ['body', 'positions'], issues);
    expect(issues.list[0]).toMatchObject({
      type: 'too_short',
      msg: 'List should have at least 1 item after validation, not 0',
      ctx: {field_type: 'List', min_length: 1, actual_length: 0},
    });
    expect(issues.list[1]).toMatchObject({
      type: 'too_long',
      msg: 'List should have at most 2 items after validation, not 3',
    });
  });

  it('checks integer bounds and literals', () => {
    const issues = new Issues();
    int({ge: 1, le: 50})(0, ['query', 'limit'], issues);
    int({ge: 1, le: 50})(51, ['query', 'limit'], issues);
    literal(['guild', 'user'])('team', ['body', 'kind'], issues);
    expect(issues.list.map((issue) => issue.type)).toEqual(['greater_than_equal', 'less_than_equal', 'literal_error']);
    expect(issues.list[2]?.msg).toBe("Input should be 'guild' or 'user'");
  });

  it('turns a broken body into json_invalid and an empty required body into missing', () => {
    expect(failure(() => parseBody('{"a":', model({a: opt(str())}))).body).toMatchObject({
      error: 'Validation error',
      detail: [{type: 'json_invalid', msg: 'JSON decode error'}],
    });
    expect(failure(() => parseBody('', model({a: req(str())}), {required: true})).body).toMatchObject({
      detail: [{type: 'missing', loc: ['body']}],
    });
    expect(parseBody('', model({a: opt(str())}))).toEqual({});
  });
});

describe('query and path parameters', () => {
  it('parses integers, booleans and repeated or comma-separated arrays', () => {
    const issues = new Issues();
    const params = new Params(
      'query',
      new URLSearchParams('limit=12&include_nsfw=yes&positions=moderator&positions=admin,support'),
      issues,
    );
    expect(params.int('limit', {def: 20, ge: 1, le: 50})).toBe(12);
    expect(params.bool('include_nsfw')).toBe(true);
    expect(params.strings('positions')).toEqual(['moderator', 'admin', 'support']);
    expect(issues.ok).toBe(true);
  });

  it('reports int_parsing and bound errors with the raw input', () => {
    const issues = new Issues();
    const params = new Params('query', new URLSearchParams('limit=abc&guild_id=12x'), issues);
    params.int('limit', {def: 20, ge: 1, le: 50});
    params.string('guild_id', {pattern: /^\d{1,19}$/});
    expect(issues.list).toMatchObject([
      {type: 'int_parsing', loc: ['query', 'limit'], input: 'abc'},
      {type: 'string_pattern_mismatch', loc: ['query', 'guild_id'], input: '12x'},
    ]);
  });

  it('keeps a snowflake path id exact', () => {
    const issues = new Issues();
    expect(new Params('path', {guildId: '812345678901234567'}, issues).snowflake('guildId')).toBe('812345678901234567');
    new Params('path', {guildId: 'abc'}, issues).snowflake('guildId');
    expect(issues.list[0]).toMatchObject({type: 'int_parsing', loc: ['path', 'guildId']});
  });
});

describe('the rules of LINEUP.md §4', () => {
  it('accepts https URLs only, without credentials, spaces or odd ports', () => {
    expect(urlProblem('https://forms.example.com/modo')).toBeNull();
    expect(urlProblem('https://example.com:443/x')).toBeNull();
    expect(urlProblem('http://example.com')).not.toBeNull();
    expect(urlProblem('https://user:pw@example.com')).not.toBeNull();
    expect(urlProblem('https://example.com:8443')).not.toBeNull();
    expect(urlProblem('https://exa mple.com')).not.toBeNull();
    expect(urlProblem(`https://example.com/${'a'.repeat(500)}`)).not.toBeNull();
    expect(urlProblem('javascript:alert(1)')).not.toBeNull();
  });

  it('accepts IANA zones and UTC offsets', () => {
    expect(timezoneProblem('Europe/Paris')).toBeNull();
    expect(timezoneProblem('UTC+02:00')).toBeNull();
    expect(timezoneProblem('UTC-14:00')).toBeNull();
    expect(timezoneProblem('UTC+15:00')).not.toBeNull();
    expect(timezoneProblem('UTC+02:60')).not.toBeNull();
    expect(timezoneProblem('Mars/Olympus')).not.toBeNull();
    expect(timezoneProblem('Paris')).not.toBeNull();
  });

  it('lower-cases and trims tags, then checks the pattern', () => {
    const issues = new Issues();
    expect(tag('  Minecraft ', ['body', 'tags', 0], issues)).toBe('minecraft');
    expect(tag('a', ['body', 'tags', 1], issues)).toBe(BAD);
    expect(tag('has space', ['body', 'tags', 2], issues)).toBe(BAD);
    expect(issues.list[0]?.msg).toMatch(/^Value error, Tag invalide/);
  });

  it('checks a requirement against its catalog entry', () => {
    const run = (input: unknown) => {
      const issues = new Issues();
      const result = requirement(input, ['body', 'requirements', 0], issues);
      return {result, issues: issues.list};
    };
    expect(run({type: 'min_age', value: 16}).result).toEqual({
      type: 'min_age',
      value: 16,
      label: null,
      verified_by_lineup: false,
    });
    expect(run({type: 'min_age', value: 12}).issues[0]?.loc).toEqual(['body', 'requirements', 0, 'value']);
    expect(run({type: 'verified_experience', verified_by_lineup: true}).result).toMatchObject({
      value: null,
      verified_by_lineup: true,
    });
    expect(run({type: 'verified_experience', value: 3}).issues).toHaveLength(1);
    expect(run({type: 'languages', value: ['fr', 'en']}).result).toMatchObject({value: ['fr', 'en']});
    expect(run({type: 'languages', value: []}).issues).toHaveLength(1);
    expect(run({type: 'voice_required', value: true}).result).toMatchObject({value: true});
    expect(run({type: 'custom', value: 'Savoir utiliser Moddy'}).issues[0]?.loc).toEqual([
      'body',
      'requirements',
      0,
      'label',
    ]);
    expect(run({type: 'custom', value: 'x', label: 'Outils'}).result).toMatchObject({label: 'Outils'});
    // `verified_by_lineup` only where Lineup can check it (§4, §8).
    expect(run({type: 'experience_months', value: 12, verified_by_lineup: true}).issues[0]?.loc).toEqual([
      'body',
      'requirements',
      0,
      'verified_by_lineup',
    ]);
    expect(run({type: 'nope', value: 1}).issues).toHaveLength(1);
  });

  it('parses an application: url required for a link, forbidden for a DM', () => {
    const run = (input: unknown) => {
      const issues = new Issues();
      return {result: application(input, ['body', 'application'], issues), issues: issues.list};
    };
    expect(run({type: 'discord_dm'}).result).toEqual({type: 'discord_dm', url: null});
    expect(run({type: 'discord_dm', url: 'https://x.example.com'}).issues[0]?.type).toBe('extra_forbidden');
    expect(run({type: 'external_url'}).issues[0]?.type).toBe('missing');
    expect(run({type: 'external_url', url: 'http://x.example.com'}).issues[0]?.type).toBe('value_error');
    expect(run({type: 'lineup_form'}).result).toEqual({type: 'lineup_form', url: null});
  });

  it('checks the commitment ranges', () => {
    const issues = new Issues();
    commitment({hours_per_week: 169, openings: 0, compensation: 'gold'}, ['body', 'commitment'], issues);
    expect(issues.list.map((issue) => issue.loc.join('.'))).toEqual([
      'body.commitment.hours_per_week',
      'body.commitment.compensation',
      'body.commitment.openings',
    ]);
  });

  it('wants a time zone and at most 180 days for expires_at', () => {
    const issues = new Issues();
    awareDatetime('2026-12-01T00:00:00', ['body', 'expires_at'], issues);
    expect(issues.list[0]?.type).toBe('timezone_aware');
    const create = createPostBody(NOW);
    const base = {kind: 'user', title: 'Hello there', description: 'x'.repeat(30), positions: ['moderator']};
    const far = new Issues();
    create({...base, expires_at: '2027-12-01T00:00:00+00:00'}, ['body'], far);
    expect(far.list[0]?.loc).toEqual(['body', 'expires_at']);
    const ok = new Issues();
    expect(create({...base, expires_at: '2026-12-01T00:00:00+00:00'}, ['body'], ok)).not.toBe(BAD);
  });

  it('couples positions_other to `other` and guild_id to the kind at creation', () => {
    const create = createPostBody(NOW);
    const base = {title: 'Hello there', description: 'x'.repeat(30)};
    const run = (input: unknown) => {
      const issues = new Issues();
      create(input, ['body'], issues);
      return issues.list.map((issue) => issue.loc.join('.'));
    };
    expect(run({...base, kind: 'user', positions: ['other']})).toEqual(['body.positions_other']);
    expect(run({...base, kind: 'user', positions: ['moderator'], positions_other: ['x']})).toEqual([
      'body.positions_other',
    ]);
    expect(run({...base, kind: 'guild', positions: ['moderator']})).toEqual(['body.guild_id']);
    expect(run({...base, kind: 'user', guild_id: '1', positions: ['moderator']})).toEqual(['body.guild_id']);
    expect(
      run({
        ...base,
        kind: 'guild',
        guild_id: '1',
        positions: ['moderator'],
        featured_experience_id: 'a0000000-0000-4000-8000-000000000001',
      }),
    ).toEqual(['body.featured_experience_id']);
    expect(run({...base, kind: 'user', positions: ['moderator', 'moderator']})).toEqual(['body.positions']);
  });
});
