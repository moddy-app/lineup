import {afterEach, describe, expect, it} from 'vitest';

import {consumeAuthError, stripAuthError, takeAuthError} from './authError';

describe('stripAuthError', () => {
  it('reads and removes the parameter, alone', () => {
    expect(stripAuthError('?auth_error=access_denied')).toEqual({code: 'access_denied', search: ''});
  });

  it('keeps every other parameter, in order', () => {
    expect(stripAuthError('?q=mod&auth_error=access_denied&kind=guild')).toEqual({
      code: 'access_denied',
      search: '?q=mod&kind=guild',
    });
  });

  it('keeps repeated parameters', () => {
    expect(stripAuthError('?positions=a&positions=b&auth_error=x').search).toBe('?positions=a&positions=b');
  });

  it('leaves a query string without it untouched', () => {
    expect(stripAuthError('?q=mod')).toEqual({code: null, search: '?q=mod'});
    expect(stripAuthError('')).toEqual({code: null, search: ''});
  });

  it('reports an empty value as an unknown failure, and cuts a long one to 64 characters', () => {
    expect(stripAuthError('?auth_error=').code).toBe('unknown');
    expect(stripAuthError(`?auth_error=${'a'.repeat(100)}`).code).toHaveLength(64);
  });
});

describe('consumeAuthError', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '/');
    takeAuthError();
  });

  it('removes only auth_error from the address, keeping path, other parameters and hash', () => {
    window.history.replaceState({key: 1}, '', '/posts/abc?x=1&auth_error=access_denied#top');
    consumeAuthError();
    expect(window.location.pathname + window.location.search + window.location.hash).toBe('/posts/abc?x=1#top');
    expect(window.history.state).toEqual({key: 1});
    expect(takeAuthError()).toBe('access_denied');
    expect(takeAuthError()).toBeNull();
  });

  it('does nothing without the parameter', () => {
    window.history.replaceState(null, '', '/guilds?q=a');
    consumeAuthError();
    expect(window.location.search).toBe('?q=a');
    expect(takeAuthError()).toBeNull();
  });
});
