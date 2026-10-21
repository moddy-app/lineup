import {describe, expect, it} from 'vitest';

import {paths} from './paths';

describe('paths.postNew', () => {
  it('has no query by default', () => {
    expect(paths.postNew()).toBe('/posts/new');
  });

  it('preselects the kind', () => {
    expect(paths.postNew('user')).toBe('/posts/new?kind=user');
    expect(paths.postNew('guild')).toBe('/posts/new?kind=guild');
  });
});
