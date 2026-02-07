/**
 * Simple auth state bridge that allows non-React code (like beforeLoad)
 * to access the Convex auth state. Updated from inside the React tree
 * via the AuthBridge component in router.tsx.
 */
export interface AuthStore {
  isAuthenticated: boolean
  isLoading: boolean
  /** Returns a promise that resolves once auth state is no longer loading */
  waitForAuth: () => Promise<{ isAuthenticated: boolean }>
}

export function createAuthStore(): AuthStore {
  let _isAuthenticated = false
  let _isLoading = true
  let _resolveAuth: ((value: { isAuthenticated: boolean }) => void) | null = null
  const _authPromise = new Promise<{ isAuthenticated: boolean }>((resolve) => {
    _resolveAuth = resolve
  })

  return {
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
