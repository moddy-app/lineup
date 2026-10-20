import {afterEach, describe, expect, it, vi} from 'vitest';

import {mockWorker} from '../../scripts/vite-plugin-mock-worker';

// `loadEnv` reads the mode's .env files and the shell: here, only the shell (the real Vite cannot load under jsdom).
vi.mock('vite', () => ({loadEnv: () => ({VITE_MOCK_API: process.env.VITE_MOCK_API})}));

/**
 * Whether the plugin would serve (dev) or emit (build) the worker, for a Vite command, a mode and the
 * `VITE_MOCK_API` flag. It must match `src/main.tsx`: flag set AND (dev server OR `--mode mock`).
 */
function active(command: 'serve' | 'build', mode: string, flag: string | undefined, root = process.cwd()) {
  if (flag === undefined) vi.stubEnv('VITE_MOCK_API', '');
  else vi.stubEnv('VITE_MOCK_API', flag);
  const plugin = mockWorker();
  const config = plugin.config as (config: {root: string}, env: {command: string; mode: string}) => void;
  config.call({} as never, {root}, {command, mode});
  let served = false;
  const configureServer = plugin.configureServer as (server: unknown) => void;
  configureServer.call({} as never, {
    middlewares: {
      use: () => {
        served = true;
      },
    },
  });
  const emitted: string[] = [];
  const generateBundle = plugin.generateBundle as () => void;
  generateBundle.call({emitFile: (file: {fileName: string}) => emitted.push(file.fileName)} as never);
  return {served, emitted};
}

afterEach(() => vi.unstubAllEnvs());

describe('the worker plugin', () => {
  it('serves the worker on the dev server when the mock is asked for, whatever the mode', () => {
    expect(active('serve', 'mock', '1').served).toBe(true);
    expect(active('serve', 'development', '1').served).toBe(true);
  });

  it('emits the worker only in `vite build --mode mock`', () => {
    expect(active('build', 'mock', '1').emitted).toEqual(['mockServiceWorker.js']);
    expect(active('build', 'production', '1').emitted).toEqual([]);
    expect(active('build', 'staging', '1').emitted).toEqual([]);
  });

  it('does nothing without the flag, so a normal dev server or a normal build has no worker', () => {
    for (const [command, mode] of [
      ['serve', 'development'],
      ['build', 'production'],
    ] as const) {
      const result = active(command, mode, undefined);
      expect([command, result.served, result.emitted]).toEqual([command, false, []]);
    }
    expect(active('serve', 'development', '0').served).toBe(false);
  });
});
