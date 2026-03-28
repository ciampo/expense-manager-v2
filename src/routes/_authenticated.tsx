import { createFileRoute, Outlet, Link, redirect } from '@tanstack/react-router'
import { useAuthActions } from '@convex-dev/auth/react'
import { useConvexAuth } from 'convex/react'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '../../convex/_generated/api'
import { Button } from '@/components/ui/button'
import { RouteNotFoundComponent } from '@/components/route-not-found'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { HugeiconsIcon } from '@hugeicons/react'
import { Menu01Icon } from '@hugeicons/core-free-icons'
import { toast } from 'sonner'

export const Route = createFileRoute('/_authenticated')({
  // Synchronous guard following TanStack Router's recommended auth pattern.
  // When auth is still loading we let the route render (the component shows
  // a skeleton). Once AuthBridge calls router.invalidate() after auth settles,
  // beforeLoad re-runs and redirects if the user is not authenticated.
  ssr: false,
  beforeLoad: ({ context }) => {
    if (!context.authStore.isLoading && !context.authStore.isAuthenticated) {
      throw redirect({ to: '/sign-in' })
    }
  },
  notFoundComponent: RouteNotFoundComponent,
  component: AuthenticatedRoute,
})

function AuthenticatedRoute() {
  const { isLoading, isAuthenticated } = useConvexAuth()
  if (isLoading || !isAuthenticated) {
    return <AuthenticatedSkeleton />
  }
  return <AuthenticatedLayout />
}

function AuthenticatedSkeleton() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-background sticky top-0 z-50 border-b">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="size-8 rounded-full" />
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="flex-1">
        <div className="container mx-auto px-4 py-8">
          <Skeleton className="mb-4 h-8 w-64" />
          <Skeleton className="h-64 w-full" />
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

function AuthenticatedLayout() {
  const { signOut } = useAuthActions()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleSignOut = async () => {
    try {
      await signOut()
      toast.success('Logged out successfully')
      // No explicit navigate() needed: AuthBridge detects the auth state
      // change and calls router.invalidate(), which re-runs _authenticated's
      // beforeLoad — that guard sees isAuthenticated: false and redirects
      // to /sign-in automatically.
    } catch {
      toast.error('Error during logout')
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="bg-background sticky top-0 z-50 border-b">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          {/* Logo */}
          <Link to="/dashboard" className="text-xl font-bold">
            Expense Manager
          </Link>

          {/* Desktop Navigation */}
          <nav aria-label="Main navigation" className="hidden items-center gap-6 md:flex">
            <Link
              to="/dashboard"
              className="text-muted-foreground hover:text-foreground [&.active]:text-foreground relative text-sm font-medium transition-colors"
            >
              Dashboard
              <DraftCountIndicator />
            </Link>
            <Link
              to="/reports"
              className="text-muted-foreground hover:text-foreground [&.active]:text-foreground text-sm font-medium transition-colors"
            >
              Reports
            </Link>
            <Link
              to="/settings"
              className="text-muted-foreground hover:text-foreground [&.active]:text-foreground text-sm font-medium transition-colors"
            >
              Settings
            </Link>

            {/* User menu */}
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="User menu"
                className="hover:bg-muted focus-visible:ring-ring relative flex size-8 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:outline-none"
              >
                <Avatar className="size-8">
                  <AvatarFallback>U</AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleSignOut}>Logout</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>

          {/* Mobile hamburger menu */}
          <Dialog open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <DialogTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Open menu"
                  className="md:hidden"
                />
              }
            >
              <HugeiconsIcon icon={Menu01Icon} strokeWidth={2} />
            </DialogTrigger>
            <DialogContent className="sm:max-w-xs">
              <DialogTitle>Menu</DialogTitle>
              <nav aria-label="Mobile navigation" className="mt-2 flex flex-col gap-4">
                <Link
                  to="/dashboard"
                  className="text-muted-foreground hover:text-foreground [&.active]:text-foreground text-sm font-medium transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <span className="inline-flex items-center gap-1.5">
                    Dashboard
                    <DraftCountIndicator />
                  </span>
                </Link>
                <Link
                  to="/reports"
                  className="text-muted-foreground hover:text-foreground [&.active]:text-foreground text-sm font-medium transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Reports
                </Link>
                <Link
                  to="/settings"
                  className="text-muted-foreground hover:text-foreground [&.active]:text-foreground text-sm font-medium transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Settings
                </Link>
                <hr className="border-t" />
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false)
                    handleSignOut()
                  }}
                  className="text-destructive hover:text-destructive/80 text-left text-sm font-medium transition-colors"
                >
                  Logout
                </button>
              </nav>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {/* Main content */}
      <main id="main-content" tabIndex={-1} className="flex-1">
        <Outlet />
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

function DraftCountIndicator() {
  const { data: count } = useQuery({
    ...convexQuery(api.expenses.draftCount, {}),
  })

  if (!count) return null

  return (
    <span
      className="bg-primary text-primary-foreground inline-flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-4 font-semibold"
      aria-label={`${count} draft expense${count === 1 ? '' : 's'}`}
    >
      {count}
    </span>
  )
}
