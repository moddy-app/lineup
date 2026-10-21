import {describe, expect, it} from 'vitest';

import {ownerActions} from './postActions';

describe('ownerActions', () => {
  it('gives nothing to a reader', () => {
    expect(ownerActions({status: 'published', can_edit: false})).toEqual([]);
  });
  it('follows the state machine', () => {
    expect(ownerActions({status: 'draft', can_edit: true})).toEqual(['publish', 'edit', 'delete']);
    expect(ownerActions({status: 'published', can_edit: true})).toEqual(['edit', 'close', 'delete']);
    expect(ownerActions({status: 'closed', can_edit: true})).toEqual(['reopen', 'edit', 'delete']);
  });
  it('leaves a hidden post alone', () => {
    expect(ownerActions({status: 'hidden', can_edit: true})).toEqual([]);
  });
});
