import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import { resolve } from 'path'

/**
 * Playwright global teardown — runs after all tests finish (pass or fail).
 * Calls the Convex cleanup mutation to remove test data and auth users.
 *
 * Loads CONVEX_DEPLOY_KEY from .env.test (if present) so local E2E runs
 * clean up automatically without needing a manual `export`.
 * In CI, the key is injected via GitHub Actions secrets and takes precedence.
 */
export default function globalTeardown() {
  // Load .env.test so CONVEX_DEPLOY_KEY is available locally without manual export.
  // Existing env vars (e.g. from CI) take precedence.
  loadEnvFile(resolve(__dirname, '..', '.env.test'))

  if (!process.env.CONVEX_DEPLOY_KEY) {
    console.warn(
      '[global-teardown] CONVEX_DEPLOY_KEY not set — skipping test data cleanup. ' +
        'Add it to .env.test or export it to clean up after local E2E runs.'
    )
    return
  }

  try {
    console.log('[global-teardown] Cleaning up test data...')
    execSync('pnpm test:e2e:cleanup', {
      stdio: 'inherit',
      env: { ...process.env },
    })
    console.log('[global-teardown] Cleanup complete.')
  } catch (error) {
    // Don't fail the test run if cleanup fails — log and move on
    console.error('[global-teardown] Cleanup failed:', error)
  }
}

/**
 * Minimal .env file loader — no external dependencies.
 * Parses KEY=value lines (ignores comments and blanks).
 * Does NOT override variables already set in process.env.
 */
function loadEnvFile(filePath: string) {
  try {
    const content = readFileSync(filePath, 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIndex = trimmed.indexOf('=')
      if (eqIndex === -1) continue
      const key = trimmed.slice(0, eqIndex).trim()
      const value = trimmed.slice(eqIndex + 1).trim()
      // Don't override existing env vars (CI secrets take precedence)
      if (!(key in process.env)) {
        process.env[key] = value
      }
    }
  } catch {
    // File doesn't exist — that's fine, skip silently
  }
}
