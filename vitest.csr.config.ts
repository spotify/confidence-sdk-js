import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['csr/*/src/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/*.integration.test.ts'],
    passWithNoTests: true,
    reporters: ['default', ['junit', { outputFile: 'test-results.xml' }]],
  },
});
