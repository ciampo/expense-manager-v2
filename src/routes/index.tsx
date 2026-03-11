import { createFileRoute, Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { MAX_FILE_SIZE } from '@/lib/schemas'

export const Route = createFileRoute('/')({
  component: LandingPage,
})

function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <h1 className="text-xl font-bold">Expense Manager</h1>
          <nav aria-label="Main navigation">
            <div className="flex gap-2">
              <Button variant="ghost" render={<Link to="/sign-in" />}>
                Sign In
              </Button>
              <Button render={<Link to="/sign-up" />}>Sign Up</Button>
            </div>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main id="main-content" tabIndex={-1} className="flex flex-1 items-center justify-center">
        <div className="container mx-auto px-4 py-16">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="mb-6 text-4xl font-bold tracking-tight sm:text-5xl">
              Manage your work expenses
            </h2>
            <p className="text-muted-foreground mb-8 text-xl">
              Easily track coworking, lunch, and business dinner expenses. Generate monthly reports
              and download receipts in one click.
            </p>
            <div className="flex justify-center gap-4">
              <Button size="lg" render={<Link to="/sign-up" />}>
                Start for free
              </Button>
              <Button size="lg" variant="outline" render={<Link to="/sign-in" />}>
                Sign In
              </Button>
            </div>
          </div>

          {/* Features */}
          <div className="mx-auto mt-16 grid max-w-4xl gap-6 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>
                  <span aria-hidden="true">📊</span> Dashboard
                </CardTitle>
                <CardDescription>View all your expenses in a single organized view</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">
                  Interactive table with filters and sorting by date, amount, and category.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>
                  <span aria-hidden="true">📎</span> Attachments
                </CardTitle>
                <CardDescription>Upload receipts and invoices for each expense</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">
                  Support for images and PDFs up to {Math.round(MAX_FILE_SIZE / (1024 * 1024))}MB.
                  Bulk download in ZIP format.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>
                  <span aria-hidden="true">📄</span> Reports
                </CardTitle>
                <CardDescription>Generate monthly reports ready for accounting</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">
                  CSV export grouped by day and category. Download monthly attachments.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-6">
        <div className="text-muted-foreground container mx-auto px-4 text-center text-sm">
          © {new Date().getFullYear()} Expense Manager. All rights reserved.
        </div>
      </footer>
    </div>
  )
}
