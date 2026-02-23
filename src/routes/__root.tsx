import { useEffect } from 'react'
import { QueryClient } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  type ErrorComponentProps,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/sonner'
import type { AuthStore } from '@/lib/auth-store'

import appCss from '../App.css?url'

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="bg-background flex min-h-screen flex-col items-center justify-center px-4 text-center"
    >
      <h1 className="text-foreground text-6xl font-bold">Error</h1>
      <p className="text-muted-foreground mt-4 text-xl">Something went wrong</p>
      <p className="text-muted-foreground mx-auto mt-2 max-w-md text-sm">
        {error.message || 'An unexpected error occurred.'}
      </p>
      <div className="mt-6 flex gap-4">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" render={<Link to="/" />}>
          Go back home
        </Button>
      </div>
    </main>
  )
}

function NotFoundComponent() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="bg-background flex min-h-screen flex-col items-center justify-center px-4 text-center"
    >
      <h1 className="text-foreground text-6xl font-bold">404</h1>
      <p className="text-muted-foreground mt-4 text-xl">Page not found</p>
      <p className="text-muted-foreground mx-auto mt-2 max-w-md text-sm">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <div className="mt-6">
        <Button render={<Link to="/" />}>Go back home</Button>
      </div>
    </main>
  )
}

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
  authStore: AuthStore
}>()({
  errorComponent: ErrorComponent,
  notFoundComponent: NotFoundComponent,
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'Expense Manager',
      },
      {
        name: 'description',
        content:
          'Track and manage your work-related expenses. Generate monthly reports and download receipts.',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),

  component: RootComponent,
})

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  // Signal that React has hydrated the page. E2E tests wait for this
  // attribute instead of probing React internals (__reactFiber, etc.),
  // which makes them resilient across React versions.
  useEffect(() => {
    document.body.setAttribute('data-hydrated', 'true')
  }, [])

  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="bg-background min-h-screen font-sans antialiased">
        <a
          href="#main-content"
          className="focus:bg-background focus:text-foreground sr-only focus:not-sr-only focus:absolute focus:z-100 focus:p-4"
        >
          Skip to content
        </a>
        {children}
        <Toaster />
        {import.meta.env.DEV && (
          <>
            <ReactQueryDevtools initialIsOpen={false} />
            <TanStackDevtools
              config={{
                position: 'bottom-right',
              }}
              plugins={[
                {
                  name: 'TanStack Router',
                  render: <TanStackRouterDevtoolsPanel />,
                },
              ]}
            />
          </>
        )}
        <Scripts />
      </body>
    </html>
  )
}
