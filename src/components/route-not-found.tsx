import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'

/**
 * Not-found component for use inside layout routes (nav stays visible).
 * Contrasts with the root-level NotFoundComponent which renders full-page.
 */
export function RouteNotFoundComponent(): React.ReactNode {
  return (
    <div className="container mx-auto flex flex-col items-center justify-center px-4 py-16 text-center">
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
