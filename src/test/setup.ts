import {cleanup} from '@testing-library/react';
import {afterEach} from 'vitest';

// Vitest has no globals here, so Testing Library cannot clean up after itself.
afterEach(cleanup);

// jsdom has no layout engine: the few browser APIs the app calls at import
// time are stubbed here.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }),
});
