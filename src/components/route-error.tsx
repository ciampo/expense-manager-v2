import { Link, type ErrorComponentProps } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'

/**
 * Error component for use inside layout routes (nav stays visible).
 * Contrasts with the root-level error component which renders full-page.
 */
export function RouteErrorComponent({ error, reset }: ErrorComponentProps) {
  return (
    <div className="container mx-auto flex flex-col items-center justify-center px-4 py-16 text-center">
      <h1 className="text-foreground text-4xl font-bold">Something went wrong</h1>
      <p className="text-muted-foreground mt-4 max-w-md text-sm">
        {error.message || 'An unexpected error occurred.'}
      </p>
      <div className="mt-6 flex gap-4">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" render={<Link to="/dashboard" />}>
          Back to dashboard
        </Button>
      </div>
    </div>
  )
}
