import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {ignores: ['dist', 'dist-mock', 'node_modules', 'design-kit', 'artifacts', 'public']},
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended, reactHooks.configs.flat.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: {...globals.browser},
    },
    plugins: {'react-refresh': reactRefresh},
    rules: {
      // A provider and its hook share a file: the hook is allowed to sit next to it.
      'react-refresh/only-export-components': [
        'warn',
        {allowConstantExport: true, allowExportNames: ['useSession', 'useSnackbar']},
      ],
      '@typescript-eslint/consistent-type-imports': ['error', {fixStyle: 'inline-type-imports'}],
      '@typescript-eslint/no-unused-vars': ['error', {argsIgnorePattern: '^_', varsIgnorePattern: '^_'}],
    },
  },
  {
    // Build scripts and config run in Node.
    files: ['scripts/**/*.ts', 'vite.config.ts', 'eslint.config.js'],
    languageOptions: {globals: {...globals.node}},
  },
);
