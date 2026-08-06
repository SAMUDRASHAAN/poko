// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

/**
 * Conventions as lint rules.
 * Every rule here replaces a paragraph that would otherwise be re-explained
 * in AGENTS.md every session. If an instruction is mechanically checkable,
 * it belongs here, not in prose.
 */
export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/.expo/**',
      '**/coverage/**',
      '**/*.d.ts',
      // Throwaway spikes are not production code and are deliberately exempt.
      // The engine invariants encoded below — no `Date.now()` [INV-5], no hex
      // literals [INV-13], no `console` — are correct for `packages/**` and
      // meaningless for a spike whose entire job is to log timestamped frame
      // events. `spikes/**` is already outside the pnpm workspace and outside
      // depcruise's scan scope; this closes the last hole in that isolation.
      // Spikes are deleted or archived once their verdict is recorded.
      'spikes/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  prettier,

  {
    languageOptions: {
      parserOptions: {
        projectService: { allowDefaultProject: ['*.ts'] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      eqeqeq: ['error', 'always'],
      'no-console': ['error', { allow: ['warn', 'error'] }],

      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']",
          message:
            'INV-3: all randomness goes through rng.ts with an explicit seed. ' +
            'Math.random() breaks determinism and every golden-seed test.',
        },
        {
          selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
          message: 'INV-5: reducers must be pure. Pass time in as a parameter instead.',
        },
      ],

      // Storage and platform guards
      'no-restricted-globals': [
        'error',
        {
          name: 'localStorage',
          message: 'Use packages/client-data (SQLite). Browser storage is unavailable.',
        },
        {
          name: 'sessionStorage',
          message: 'Use packages/client-data (SQLite). Browser storage is unavailable.',
        },
      ],

      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@poko/*/src/*', '@poko/*/dist/*'],
              message: 'Import from the package root. Deep imports break the public contract.',
            },
          ],
        },
      ],
    },
  },

  // Repository JavaScript config files are not part of a TypeScript project.
  // They still receive the base JS rules, but not rules that require type info.
  {
    files: ['**/*.js', '**/*.mjs'],
    ...tseslint.configs.disableTypeChecked,
  },

  // INV-13: tokens.ts is the one intentional source of colour literals.
  {
    files: ['**/*.{js,mjs,ts,tsx,jsx}'],
    ignores: ['packages/ui/src/tokens.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/^#[0-9a-fA-F]{3,8}$/]',
          message: 'INV-13: colours come from packages/ui/src/tokens.ts. No hex literals.',
        },
        {
          selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']",
          message:
            'INV-3: all randomness goes through rng.ts with an explicit seed. ' +
            'Math.random() breaks determinism and every golden-seed test.',
        },
        {
          selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
          message: 'INV-5: reducers must be pure. Pass time in as a parameter instead.',
        },
      ],
    },
  },

  // INV-1 + INV-5: the engine is pure, headless and deterministic
  {
    files: ['packages/engine/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react-*', 'react-native*', 'expo*', '@poko/*', 'node:*'],
              message:
                'INV-1: packages/engine imports nothing. Standard library only. ' +
                'If you need this, you are writing the code in the wrong package — ' +
                'see ARCHITECTURE.md section 6.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'INV-1: the engine is headless.' },
        { name: 'document', message: 'INV-1: the engine is headless.' },
        { name: 'fetch', message: 'INV-1: the engine performs no I/O.' },
      ],
    },
  },

  // Tests may be looser
  {
    files: ['**/__tests__/**', '**/*.spec.ts', '**/*.test.ts', 'tools/**'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'no-restricted-syntax': 'off',
    },
  },
);
