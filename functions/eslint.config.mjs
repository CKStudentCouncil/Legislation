import globals from 'globals';
import pluginJs from '@eslint/js';
import * as importPlugin from 'eslint-plugin-import';
import tseslint from 'typescript-eslint';

/** @type {import('eslint').Linter.Config[]} */
export default [
  { files: ['**/*.{js,mjs,cjs,ts}'] },
  { languageOptions: { globals: globals.node } },
  pluginJs.configs.recommended,
  importPlugin.flatConfigs?.errors,
  importPlugin.flatConfigs?.warnings,
  importPlugin.flatConfigs?.typescript,
  ...tseslint.configs.recommended,
  {
    rules: {
      'quotes': ['error', 'single'],
      'import/no-unresolved': 'off',
      'indent': ['error', 2],
    }
  },
  {
    ignores: [
      'lib/', // Ignore built files.
      'generated/', // Ignore generated files.
    ],
  },
];
