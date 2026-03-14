export const AUTH_TIMEOUT_MS = 10_000

/**
 * Simple auth state bridge that allows non-React code (like beforeLoad)
 * to access the Convex auth state. Updated by the AuthBridge component
 * in router.tsx — via useLayoutEffect on the client (synchronously after
 * render, before paint) and synchronously during render on the server
 * (where effects don't fire).
 *
 * The `invalidateRouter` callback is set by `getRouter()` after the router
 * is created, and called by AuthBridge (via useEffect) when auth state
 * settles — this triggers TanStack Router to re-evaluate its beforeLoad
 * guards, producing automatic redirects (e.g. auth pages → /dashboard
 * after sign-in, authenticated pages → /sign-in after sign-out).
 */
export interface AuthStore {
  readonly isAuthenticated: boolean
  readonly isLoading: boolean
  /**
   * Update auth state. Called by AuthBridge via useLayoutEffect on the
   * client (synchronously after render, before paint) and synchronously
   * during render on the server (where effects don't fire). The update
   * is idempotent. Order is significant: isAuthenticated is set first,
   * then isLoading — the isLoading setter resolves the waitForAuth()
   * promise which reads isAuthenticated.
   */
  update: (state: { isAuthenticated: boolean; isLoading: boolean }) => void
  /**
   * Returns a promise that resolves once the current auth check completes
   * (isLoading transitions from true to false). If auth is not currently
   * loading, resolves immediately with the current isAuthenticated value.
   *
   * The internal promise resets whenever loading restarts (false → true),
   * so callers always wait for the most recent auth resolution.
   */
  waitForAuth: () => Promise<{ isAuthenticated: boolean }>
  /**
   * Callback to tell the router to re-evaluate route guards.
   * Set by getRouter() after the router instance is created.
   */
  invalidateRouter: (() => void) | null
  /**
   * Settle any pending internal promises so they don't leak in tests.
   * Safe to call multiple times.
   */
  destroy: () => void
}

export function createAuthStore(): AuthStore {
  let _isAuthenticated = false
  let _isLoading = true
  let _resolveAuth: ((value: { isAuthenticated: boolean }) => void) | null = null
  // Promise that resolves when the current loading phase completes.
  // Reset whenever loading restarts (false → true) so that callers
  // always wait for the most recent auth resolution.
  let _authPromise = new Promise<{ isAuthenticated: boolean }>((resolve) => {
    _resolveAuth = resolve
  })
  // Memoized timeout-wrapped promise shared by all concurrent callers
  // during a single loading phase. Reset on loading restart / settle
  // so each phase gets at most one timer.
  let _waitPromise: Promise<{ isAuthenticated: boolean }> | null = null

  function setIsLoading(value: boolean) {
    const wasLoading = _isLoading
    _isLoading = value
    // Loading restarted (e.g. token refresh) — create a fresh promise
    // so new waitForAuth() callers block until the new check completes.
    if (!wasLoading && value) {
      _authPromise = new Promise<{ isAuthenticated: boolean }>((resolve) => {
        _resolveAuth = resolve
      })
      _waitPromise = null
    }
    // Loading finished — resolve with the current auth state.
    if (wasLoading && !value && _resolveAuth) {
      _resolveAuth({ isAuthenticated: _isAuthenticated })
      _resolveAuth = null
      _waitPromise = null
    }
  }

  return {
    invalidateRouter: null,
    get isAuthenticated() {
      return _isAuthenticated
    },
    get isLoading() {
      return _isLoading
    },
    update({ isAuthenticated, isLoading }) {
      _isAuthenticated = isAuthenticated
      setIsLoading(isLoading)
    },
    destroy() {
      if (_resolveAuth) {
        _resolveAuth({ isAuthenticated: false })
        _resolveAuth = null
      }
      _waitPromise = null
    },
    waitForAuth() {
      if (!_isLoading) {
        return Promise.resolve({ isAuthenticated: _isAuthenticated })
      }
      if (_waitPromise) return _waitPromise

      _waitPromise = new Promise<{ isAuthenticated: boolean }>((resolve) => {
        const timer = setTimeout(() => {
          console.warn(
            `[auth-store] waitForAuth timed out after ${AUTH_TIMEOUT_MS / 1000}s — treating user as unauthenticated`,
          )
          // Transition the store to a settled unauthenticated state so
          // subsequent guards resolve immediately instead of re-waiting.
          _isAuthenticated = false
          setIsLoading(false)
          resolve({ isAuthenticated: false })
        }, AUTH_TIMEOUT_MS)

        void _authPromise.then((result) => {
          clearTimeout(timer)
          resolve(result)
        })
      })
      return _waitPromise
    },
  }
}
