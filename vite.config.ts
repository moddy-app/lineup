import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vitest/config';

import {fontPreload} from './scripts/vite-plugin-font-preload';
import {themeBoot} from './scripts/vite-plugin-theme-boot';

/**
 * The design kit (design-kit/) is a sibling folder, linked as
 * "@moddy/design-kit": "file:./design-kit". Its sources are TypeScript with
 * Lit decorators, compiled here with the app (no prebuilt kit).
 *
 * One copy of lit and Material Web: the kit has no node_modules of its own,
 * so its imports resolve from the root node_modules. `dedupe` makes it a
 * rule: a second copy would define every custom element twice
 * ("already been defined") and break instanceof checks.
 */
export default defineConfig({
  plugins: [react(), themeBoot(), fontPreload()],
  resolve: {
    alias: {'@': fileURLToPath(new URL('./src', import.meta.url))},
    dedupe: ['lit', '@material/web', '@material/material-color-utilities'],
  },
  esbuild: {
    // Lit's @property/@customElement decorators are the legacy (TypeScript)
    // ones, and class fields must be assigned in the constructor, not
    // defined, or the reactive properties would be shadowed. The kit's own
    // tsconfig says so, but esbuild reads the tsconfig nearest to each file
    // and the kit lives in a symlinked folder: stating it here makes it hold
    // for every file, whatever the lookup finds.
    tsconfigRaw: {
      compilerOptions: {
        experimentalDecorators: true,
        useDefineForClassFields: false,
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    target: 'es2022',
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
  },
});
