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
   * Returns a promise that resolves once the initial auth check completes
   * (first isLoading true→false transition). After that first resolution,
   * returns a fresh resolved promise with the current isAuthenticated value.
   *
   * This is single-shot by design: useConvexAuth() only enters the loading
   * state once (during the initial auth check), so there is no second
   * loading phase to wait for.
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
  // Single-shot promise: resolves once on the first isLoading true→false transition.
  // After that, waitForAuth() returns a fresh resolved promise with the current state.
  // This is safe because useConvexAuth() only enters loading once (initial auth check).
  const _authPromise = new Promise<{ isAuthenticated: boolean }>((resolve) => {
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
