import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Each workspace is its own project: the frontend reuses its vite.config.ts
    projects: ['frontend', 'backend'],
    // No tests yet: remove once the first ones are written
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      include: ['frontend/src/**', 'backend/src/**'],
      reporter: ['text', 'html', 'lcov'],
    },
  },
});
