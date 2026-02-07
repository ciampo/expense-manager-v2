import { execSync } from 'child_process'

/**
 * Playwright global teardown — runs after all tests finish (pass or fail).
 * Calls the Convex cleanup mutation to remove test data and auth users.
 *
 * Requires CONVEX_DEPLOY_KEY to be set (already configured in CI via
 * GitHub secrets; locally set via `export CONVEX_DEPLOY_KEY=...`).
 */
export default function globalTeardown() {
  if (!process.env.CONVEX_DEPLOY_KEY) {
    console.warn(
      '[global-teardown] CONVEX_DEPLOY_KEY not set — skipping test data cleanup. ' +
        'Set it to clean up auth users after local E2E runs.'
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
