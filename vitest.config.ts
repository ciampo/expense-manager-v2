import { defineConfig } from 'vitest/config'
import viteReact from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [viteReact()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.{ts,tsx}', 'convex/**/*.test.ts'],
    exclude: ['tests/visual/**'],
    environment: 'jsdom',
    server: { deps: { inline: ['convex-test'] } },
    globals: true,
    // Run all tests under a negative UTC offset so timezone-sensitive date
    // tests (e.g. parseLocalDate vs new Date('YYYY-MM-DD')) are deterministic
    // and actually catch regressions. Without this, CI (typically UTC) would
    // pass even with the buggy UTC-midnight parsing.
    env: {
      TZ: 'America/New_York',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}', 'convex/**/*.ts'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/__tests__/**',
        'src/routeTree.gen.ts',
        'src/env.d.ts',
        'convex/_generated/**',
      ],
      changed: true,
    },
  },
})
