import { createFileRoute, Outlet, Link, redirect } from '@tanstack/react-router'
import { useConvexAuth } from 'convex/react'
import { Skeleton } from '@/components/ui/skeleton'

export const Route = createFileRoute('/_auth')({
  // Synchronous guard following TanStack Router's recommended auth pattern.
  // When auth is still loading we let the route render (the component shows
  // a skeleton). Once AuthBridge calls router.invalidate() after auth settles,
  // beforeLoad re-runs and redirects already-authenticated users to /dashboard.
  ssr: false,
  beforeLoad: ({ context }) => {
    if (!context.authStore.isLoading && context.authStore.isAuthenticated) {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: AuthRoute,
})

function AuthRoute() {
  const { isLoading } = useConvexAuth()
  if (isLoading) {
    return <AuthSkeleton />
  }
  return <AuthLayout />
}

function AuthSkeleton() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <Skeleton className="h-6 w-40" />
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Skeleton className="h-[400px] w-full rounded-lg" />
        </div>
      </main>
      <footer className="border-t py-6">
        <div className="container mx-auto px-4 text-center">
          <Skeleton className="mx-auto h-4 w-48" />
        </div>
      </footer>
    </div>
  )
}

function AuthLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <Link to="/" className="text-xl font-bold">
            Expense Manager
          </Link>
        </div>
      </header>

      {/* Main content */}
      <main id="main-content" tabIndex={-1} className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Outlet />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-6">
        <div className="text-muted-foreground container mx-auto px-4 text-center text-sm">
          © {new Date().getFullYear()} Expense Manager
        </div>
      </footer>
    </div>
  )
}
