import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Booting the whole AppModule touches Postgres/Redis; give it time.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Each file bootstraps TypeORM with synchronize: true, so run them serially.
    fileParallelism: false,
  },
});
