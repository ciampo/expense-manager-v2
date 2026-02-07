import { createFileRoute, Outlet, Link, useNavigate } from '@tanstack/react-router'
import { useConvexAuth } from 'convex/react'
import { useEffect } from 'react'

export const Route = createFileRoute('/_auth')({
  component: AuthLayout,
})

function AuthLayout() {
  const { isAuthenticated, isLoading } = useConvexAuth()
  const navigate = useNavigate()

  // If already authenticated, redirect to dashboard
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate({ to: '/dashboard' })
    }
  }, [isLoading, isAuthenticated, navigate])

  // Hide content while redirect is in progress to avoid flashing the form
  if (!isLoading && isAuthenticated) {
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
      <main id="main-content" className="flex-1 flex items-center justify-center p-4">
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
