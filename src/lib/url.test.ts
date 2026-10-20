import {describe, expect, it} from 'vitest';

import {safeHttpsUrl} from './url';

describe('safeHttpsUrl', () => {
  it('accepts https', () => {
    expect(safeHttpsUrl('https://moddy.app/violations')).toBe('https://moddy.app/violations');
  });

  it('refuses everything else', () => {
    for (const value of [
      'http://moddy.app',
      'javascript:alert(1)',
      'data:text/html,x',
      '/violations',
      'nope',
      '',
      null,
      undefined,
    ]) {
      expect(safeHttpsUrl(value), String(value)).toBeNull();
    }
  });
});
