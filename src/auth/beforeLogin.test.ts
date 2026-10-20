import {afterEach, describe, expect, it, vi} from 'vitest';

import {registerBeforeLogin, runBeforeLogin} from './beforeLogin';

const cleanups: Array<() => void> = [];
afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  vi.restoreAllMocks();
});

describe('registerBeforeLogin', () => {
  it('runs every registered callback', () => {
    const [a, b] = [vi.fn(), vi.fn()];
    cleanups.push(registerBeforeLogin(a), registerBeforeLogin(b));
    runBeforeLogin();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('stops running a callback once it is unregistered', () => {
    const callback = vi.fn();
    const unregister = registerBeforeLogin(callback);
    unregister();
    runBeforeLogin();
    expect(callback).not.toHaveBeenCalled();
  });

  it('does not let a failing callback stop the others', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const after = vi.fn();
    cleanups.push(
      registerBeforeLogin(() => {
        throw new Error('storage full');
      }),
      registerBeforeLogin(after),
    );
    expect(() => runBeforeLogin()).not.toThrow();
    expect(after).toHaveBeenCalled();
  });

  it('is safe with nothing registered', () => {
    expect(() => runBeforeLogin()).not.toThrow();
  });
});
