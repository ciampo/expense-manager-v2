import { createFileRoute, Outlet, Link } from '@tanstack/react-router'
import { useConvexAuth } from 'convex/react'

export const Route = createFileRoute('/_auth')({
  component: AuthLayout,
})

function AuthLayout() {
  const { isAuthenticated, isLoading } = useConvexAuth()

  // If already authenticated, redirect to dashboard
  if (!isLoading && isAuthenticated) {
    // This will be handled by the loader, but we also handle it here for client-side navigation
    return null
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <Link to="/" className="text-xl font-bold">
            Expense Manager
          </Link>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Outlet />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-6">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} Expense Manager
        </div>
      </footer>
    </div>
  )
}
