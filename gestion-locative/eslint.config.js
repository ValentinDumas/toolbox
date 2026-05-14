// @ts-check
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import importPlugin from 'eslint-plugin-import';
import functionalPlugin from 'eslint-plugin-functional';

/** @type {import('eslint').Linter.Config[]} */
export default [
  // Global ignores
  {
    ignores: ['node_modules/**', 'dist/**', 'coverage/**'],
  },

  // Base config for all TypeScript files
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      import: importPlugin,
      functional: functionalPlugin,
    },
    settings: {
      'import/resolver': {
        node: {
          extensions: ['.ts', '.js'],
        },
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        {
          allowExpressions: true,
          allowTypedFunctionExpressions: true,
          allowHigherOrderFunctions: true,
        },
      ],
      'import/order': [
        'warn',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'index',
          ],
          'newlines-between': 'always',
        },
      ],
    },
  },

  // Domain-only: enforce hexagonal boundary + functional immutability
  {
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['fastify', '@fastify/*'],
              message:
                'Le domaine ne doit pas dépendre de Fastify (hexagonal boundary).',
            },
            {
              group: ['kysely'],
              message:
                'Le domaine ne doit pas dépendre de Kysely (hexagonal boundary).',
            },
            {
              group: ['better-sqlite3'],
              message:
                'Le domaine ne doit pas dépendre de better-sqlite3 (hexagonal boundary).',
            },
            {
              group: ['pino'],
              message:
                'Le domaine ne doit pas dépendre de pino (hexagonal boundary).',
            },
            {
              group: ['*/infrastructure/*', '../infrastructure/*'],
              message:
                'Le domaine ne doit pas importer depuis infrastructure/.',
            },
            {
              group: ['*/web/*', '../web/*'],
              message: 'Le domaine ne doit pas importer depuis web/.',
            },
            {
              group: ['*/application/*', '../application/*'],
              message: 'Le domaine ne doit pas importer depuis application/.',
            },
          ],
        },
      ],
      'functional/no-let': 'warn',
      'functional/immutable-data': 'warn',
    },
  },

  // Tests: relax explicit return types
  {
    files: ['tests/**/*.ts'],
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off',
    },
  },
];
