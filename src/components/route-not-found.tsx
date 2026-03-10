import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'

/**
 * Not-found component for use inside layout routes (nav stays visible).
 * Contrasts with the root-level NotFoundComponent which renders full-page.
 *
 * Rendered directly by route components (not via `throw notFound()`) because
 * TanStack Router's notFound propagation always bubbles to the root 404
 * when the parent layout has `ssr: false`. Rendering inline keeps the
 * authenticated layout (header, nav, footer) visible.
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
