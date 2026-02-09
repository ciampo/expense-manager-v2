import { createRouter } from '@tanstack/react-router'
import { QueryClient } from '@tanstack/react-query'
import { routerWithQueryClient } from '@tanstack/react-router-with-query'
import { ConvexQueryClient } from '@convex-dev/react-query'
import { ConvexAuthProvider } from '@convex-dev/auth/react'
import { useConvexAuth } from 'convex/react'
import { useEffect } from 'react'

import { routeTree } from './routeTree.gen'
import { createAuthStore } from '@/lib/auth-store'
import type { AuthStore } from '@/lib/auth-store'

/**
 * React component that bridges Convex auth state into the auth store.
 * Rendered inside the Wrap component so it has access to ConvexAuthProvider.
 *
 * The store is updated eagerly during render so that synchronous reads
 * (e.g. by beforeLoad right after a re-render) always see the latest state.
 *
 * After the store is updated, `authStore.invalidateRouter()` is called
 * (via useEffect) to re-evaluate route guards. This is how TanStack Router
 * recommends reacting to external auth state changes: the auth pages'
 * beforeLoad will detect `isAuthenticated: true` and redirect to /dashboard,
 * and the authenticated pages' beforeLoad will detect `isAuthenticated: false`
 * and redirect to /sign-in — all without the sign-in/sign-up handlers
 * needing to call `navigate()` themselves.
 *
 * Note: we avoid useRouter() here because AuthBridge also renders during SSR
 * (inside Wrap), where the RouterProvider context is not yet available.
 * Instead, the invalidateRouter callback is wired up by getRouter() below.
 */
function AuthBridge({ authStore }: { authStore: AuthStore }) {
  const { isAuthenticated, isLoading } = useConvexAuth()

  // Eagerly update the store during render so beforeLoad always reads
  // current values. Order matters: isAuthenticated must be set before
  // isLoading, because the isLoading setter resolves the waitForAuth()
  // promise which reads _isAuthenticated at resolution time.
  authStore.isAuthenticated = isAuthenticated
  authStore.isLoading = isLoading

  // When auth state settles, tell the router to re-run its beforeLoad
  // guards. This triggers automatic redirects (e.g. _auth → /dashboard
  // after sign-in, _authenticated → /sign-in after sign-out).
  useEffect(() => {
    if (!isLoading) {
      authStore.invalidateRouter?.()
    }
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

  // Wire up the invalidation callback now that the router exists.
  // AuthBridge calls this when auth state settles to re-evaluate guards.
  authStore.invalidateRouter = () => router.invalidate()

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
