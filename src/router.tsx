// This file is a router factory (getRouter), not a React component module,
// so the react-refresh fast-refresh warning does not apply.
/* eslint-disable react-refresh/only-export-components */
import { createRouter } from '@tanstack/react-router'
import { QueryClient } from '@tanstack/react-query'
import { routerWithQueryClient } from '@tanstack/react-router-with-query'
import { ConvexQueryClient } from '@convex-dev/react-query'
import { ConvexAuthProvider } from '@convex-dev/auth/react'
import { useConvexAuth } from 'convex/react'
import { useEffect, useLayoutEffect } from 'react'

import { routeTree } from './routeTree.gen'
import { createAuthStore } from '@/lib/auth-store'
import type { AuthStore } from '@/lib/auth-store'

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

/**
 * React component that bridges Convex auth state into the auth store.
 * Rendered inside the Wrap component so it has access to ConvexAuthProvider.
 *
 * On the client the store is updated via useLayoutEffect (synchronously
 * after render, before paint). During SSR, effects don't fire, so the
 * store is updated synchronously during render instead (safe because SSR
 * is single-pass with no concurrent mode).
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

  // During SSR, effects don't fire, so update the store synchronously
  // during render. This is safe because SSR is single-pass (no
  // concurrent mode). On the client, use useLayoutEffect to avoid
  // render-phase side effects while still updating before paint.
  if (typeof window === 'undefined') {
    authStore.update({ isAuthenticated, isLoading })
  }

  useIsomorphicLayoutEffect(() => {
    authStore.update({ isAuthenticated, isLoading })
  }, [isAuthenticated, isLoading, authStore])

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

function initRouter() {
  const CONVEX_URL = import.meta.env.VITE_CONVEX_URL

  if (!CONVEX_URL) {
    throw new Error(
      'Missing required environment variable VITE_CONVEX_URL. ' +
        'See docs/ENVIRONMENT_VARIABLES.md for setup instructions.',
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

// Only cache on the client — SSR must create a fresh router per request
// to avoid leaking QueryClient cache and authStore between users.
let _clientRouter: ReturnType<typeof initRouter> | null = null

export function getRouter() {
  if (typeof window === 'undefined') {
    return initRouter()
  }
  if (!_clientRouter) {
    _clientRouter = initRouter()
  }
  return _clientRouter
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
