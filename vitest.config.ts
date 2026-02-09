import { defineConfig } from 'vitest/config'
import viteReact from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'url'

export default defineConfig({
  plugins: [viteReact()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.{ts,tsx}'],
    exclude: ['tests/visual/**'],
    environment: 'jsdom',
    globals: true,
    // Run all tests under a negative UTC offset so timezone-sensitive date
    // tests (e.g. parseLocalDate vs new Date('YYYY-MM-DD')) are deterministic
    // and actually catch regressions. Without this, CI (typically UTC) would
    // pass even with the buggy UTC-midnight parsing.
    env: {
      TZ: 'America/New_York',
    },
  },
})
