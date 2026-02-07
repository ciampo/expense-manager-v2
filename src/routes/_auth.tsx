import { createFileRoute, Outlet, Link, redirect } from '@tanstack/react-router'
import { Skeleton } from '@/components/ui/skeleton'

export const Route = createFileRoute('/_auth')({
  beforeLoad: async ({ context }) => {
    const { isAuthenticated } = await context.authStore.waitForAuth()
    if (isAuthenticated) {
      throw redirect({ to: '/dashboard' })
    }
  },
  pendingComponent: AuthSkeleton,
  component: AuthLayout,
})

function AuthSkeleton() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <Skeleton className="h-6 w-40" />
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Skeleton className="h-[400px] w-full rounded-lg" />
        </div>
      </main>
      <footer className="border-t py-6">
        <div className="container mx-auto px-4 text-center">
          <Skeleton className="h-4 w-48 mx-auto" />
        </div>
      </footer>
    </div>
  )
}

function AuthLayout() {
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
      <main id="main-content" tabIndex={-1} className="flex-1 flex items-center justify-center p-4">
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
