import { createFileRoute, Outlet, Link, redirect } from '@tanstack/react-router'
import { useAuthActions } from '@convex-dev/auth/react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'

export const Route = createFileRoute('/_authenticated')({
  // Auth state is client-side only (Convex), so beforeLoad must not run during SSR
  // — it awaits a promise that depends on React effects which don't fire on the server.
  ssr: false,
  beforeLoad: async ({ context }) => {
    const { isAuthenticated } = await context.authStore.waitForAuth()
    if (!isAuthenticated) {
      throw redirect({ to: '/sign-in' })
    }
  },
  pendingComponent: AuthenticatedSkeleton,
  component: AuthenticatedLayout,
})

function AuthenticatedSkeleton() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="flex-1">
        <div className="container mx-auto px-4 py-8">
          <Skeleton className="h-8 w-64 mb-4" />
          <Skeleton className="h-64 w-full" />
        </div>
      </main>
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
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b sticky top-0 bg-background z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          {/* Logo */}
          <Link to="/dashboard" className="text-xl font-bold">
            Expense Manager
          </Link>

          {/* Desktop Navigation */}
          <nav aria-label="Main" className="hidden md:flex items-center gap-6">
            <Link
              to="/dashboard"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors [&.active]:text-foreground"
            >
              Dashboard
            </Link>
            <Link
              to="/reports"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors [&.active]:text-foreground"
            >
              Reports
            </Link>

            {/* User menu */}
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="User menu"
                className="relative flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback>U</AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleSignOut}>
                  Logout
                </DropdownMenuItem>
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
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="4" x2="20" y1="12" y2="12" />
                <line x1="4" x2="20" y1="6" y2="6" />
                <line x1="4" x2="20" y1="18" y2="18" />
              </svg>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xs">
              <DialogTitle>Menu</DialogTitle>
              <nav className="flex flex-col gap-4 mt-2">
                <Link
                  to="/dashboard"
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors [&.active]:text-foreground"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Dashboard
                </Link>
                <Link
                  to="/reports"
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors [&.active]:text-foreground"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Reports
                </Link>
                <hr className="border-t" />
                <button
                  onClick={() => {
                    setMobileMenuOpen(false)
                    handleSignOut()
                  }}
                  className="text-sm font-medium text-destructive hover:text-destructive/80 transition-colors text-left"
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
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} Expense Manager
        </div>
      </footer>
    </div>
  )
}
