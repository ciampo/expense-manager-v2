/**
 * Simple auth state bridge that allows non-React code (like beforeLoad)
 * to access the Convex auth state. Updated eagerly during render by the
 * AuthBridge component in router.tsx.
 *
 * The `invalidateRouter` callback is set by `getRouter()` after the router
 * is created, and called by AuthBridge (via useEffect) when auth state
 * settles — this triggers TanStack Router to re-evaluate its beforeLoad
 * guards, producing automatic redirects (e.g. auth pages → /dashboard
 * after sign-in, authenticated pages → /sign-in after sign-out).
 */
export interface AuthStore {
  isAuthenticated: boolean
  isLoading: boolean
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

  return {
    invalidateRouter: null,
    get isAuthenticated() {
      return _isAuthenticated
    },
    get isLoading() {
      return _isLoading
    },
    set isAuthenticated(value: boolean) {
      _isAuthenticated = value
    },
    set isLoading(value: boolean) {
      const wasLoading = _isLoading
      _isLoading = value
      // Loading restarted (e.g. token refresh) — create a fresh promise
      // so new waitForAuth() callers wait for the new resolution.
      if (!wasLoading && value) {
        _authPromise = new Promise<{ isAuthenticated: boolean }>((resolve) => {
          _resolveAuth = resolve
        })
      }
      // Resolve the promise once loading completes
      if (wasLoading && !value && _resolveAuth) {
        _resolveAuth({ isAuthenticated: _isAuthenticated })
        _resolveAuth = null
      }
    },
    waitForAuth() {
      if (!_isLoading) {
        return Promise.resolve({ isAuthenticated: _isAuthenticated })
      }
      return _authPromise
    },
  }
}
