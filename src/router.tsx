import { createRouter } from '@tanstack/react-router'
import { QueryClient } from '@tanstack/react-query'
import { routerWithQueryClient } from '@tanstack/react-router-with-query'
import { ConvexQueryClient } from '@convex-dev/react-query'
import { ConvexAuthProvider } from '@convex-dev/auth/react'
import { useConvexAuth } from 'convex/react'
import { useEffect } from 'react'

import { routeTree } from './routeTree.gen'

/**
 * Simple auth state bridge that allows non-React code (like beforeLoad)
 * to access the Convex auth state. Updated from inside the React tree
 * via the AuthBridge component.
 */
export interface AuthStore {
  isAuthenticated: boolean
  isLoading: boolean
  /** Returns a promise that resolves once auth state is no longer loading */
  waitForAuth: () => Promise<{ isAuthenticated: boolean }>
}

function createAuthStore(): AuthStore {
  let _isAuthenticated = false
  let _isLoading = true
  let _resolveAuth: ((value: { isAuthenticated: boolean }) => void) | null = null
  let _authPromise = new Promise<{ isAuthenticated: boolean }>((resolve) => {
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

/**
 * React component that bridges Convex auth state into the auth store.
 * Rendered inside the Wrap component so it has access to ConvexAuthProvider.
 */
function AuthBridge({ authStore }: { authStore: AuthStore }) {
  const { isAuthenticated, isLoading } = useConvexAuth()

  useEffect(() => {
    authStore.isAuthenticated = isAuthenticated
    authStore.isLoading = isLoading
  }, [isAuthenticated, isLoading, authStore])

  return null
}

export function getRouter() {
  const CONVEX_URL = import.meta.env.VITE_CONVEX_URL

  if (!CONVEX_URL) {
    throw new Error(
      'Missing required environment variable VITE_CONVEX_URL. ' +
      'See docs/ENVIRONMENT_VARIABLES.md for setup instructions.'
    )
  }

  const convexQueryClient = new ConvexQueryClient(CONVEX_URL)

  const queryClient: QueryClient = new QueryClient({
    defaultOptions: {
      queries: {
        queryKeyHashFn: convexQueryClient.hashFn(),
        queryFn: convexQueryClient.queryFn(),
      },
    },
  })

  convexQueryClient.connect(queryClient)

  const authStore = createAuthStore()

  const router = routerWithQueryClient(
    createRouter({
      routeTree,
      defaultPreload: 'intent',
      context: { queryClient, authStore },
      scrollRestoration: true,
      Wrap: ({ children }) => (
        <ConvexAuthProvider client={convexQueryClient.convexClient}>
          <AuthBridge authStore={authStore} />
          {children}
        </ConvexAuthProvider>
      ),
    }),
    queryClient,
  )

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
