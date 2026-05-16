import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    reporter: ['dot'],
    cache: { dir: '.vitest-cache' },
    exclude: ['tests/bdd/**', 'node_modules', 'dist', 'coverage'],
    testTimeout: 10000,
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/main.ts',
        'src/web/views/**',
        'src/infrastructure/db/migrations/**',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
        'src/domain/**': {
          lines: 100,
          functions: 100,
          branches: 100,
          statements: 100,
        },
      },
    },
  },
});
