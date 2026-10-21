import {describe, expect, it} from 'vitest';

import {countLivePosts} from './postsQuota';

describe('countLivePosts', () => {
  it('counts only published, unexpired posts', () => {
    expect(
      countLivePosts([
        {status: 'published', is_expired: false},
        {status: 'published', is_expired: true},
        {status: 'draft', is_expired: false},
        {status: 'closed', is_expired: false},
        {status: 'published', is_expired: false},
      ]),
    ).toBe(2);
  });

  it('is zero for an empty list', () => {
    expect(countLivePosts([])).toBe(0);
  });
});
