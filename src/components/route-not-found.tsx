import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'

/**
 * Not-found component for authenticated/layout routes where the app chrome
 * (nav, header, footer) should remain visible.
 *
 * Used in two ways:
 * - Registered as the `_authenticated` route's `notFoundComponent`. In the
 *   current TanStack Router behavior, this mainly controls how unmatched
 *   child paths under `_authenticated` are rendered. When a parent layout
 *   has `ssr: false`, a thrown `notFound()` from descendants still bubbles
 *   to the root-level full-page 404 due to a router limitation.
 * - Rendered directly by route components that need an in-layout 404 while
 *   keeping the authenticated layout (header, nav, footer) visible. This
 *   inline rendering is the reliable approach when using layouts with
 *   `ssr: false`, since thrown `notFound()` cannot currently be handled
 *   by this in-layout `notFoundComponent`.
 *
 * Overrides the page title via React 19's `<title>` hoisting so the parent
 * route's head() title (e.g. "Edit Expense") doesn't leak through.
 */
export function RouteNotFoundComponent(): React.ReactNode {
  return (
    <div className="container mx-auto flex flex-col items-center justify-center px-4 py-16 text-center">
      <title>Not Found — Expense Manager</title>
      <h1 className="text-foreground text-4xl font-bold">404</h1>
      <p className="text-muted-foreground mt-4 max-w-md text-sm">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <div className="mt-6">
        <Button render={<Link to="/dashboard" />}>Back to dashboard</Button>
      </div>
    </div>
  )
}
