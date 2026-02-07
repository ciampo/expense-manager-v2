import { createFileRoute, Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export const Route = createFileRoute('/')({
  component: LandingPage,
})

function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold">Expense Manager</h1>
          <nav aria-label="Main">
            <div className="flex gap-2">
              <Button variant="ghost" render={<Link to="/sign-in" />}>
                Sign In
              </Button>
              <Button render={<Link to="/sign-up" />}>
                Sign Up
              </Button>
            </div>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex items-center justify-center">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-4xl font-bold tracking-tight sm:text-5xl mb-6">
              Manage your work expenses
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              Easily track coworking, lunch, and business dinner expenses.
              Generate monthly reports and download receipts in one click.
            </p>
            <div className="flex gap-4 justify-center">
              <Button size="lg" render={<Link to="/sign-up" />}>
                Start for free
              </Button>
              <Button size="lg" variant="outline" render={<Link to="/sign-in" />}>
                Sign In
              </Button>
            </div>
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-6 mt-16 max-w-4xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle>📊 Dashboard</CardTitle>
                <CardDescription>
                  View all your expenses in a single organized view
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Interactive table with filters and sorting by date, amount,
                  and category.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>📎 Attachments</CardTitle>
                <CardDescription>
                  Upload receipts and invoices for each expense
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Support for images and PDFs up to 10MB. Bulk download in
                  ZIP format.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>📄 Reports</CardTitle>
                <CardDescription>
                  Generate monthly reports ready for accounting
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  CSV export grouped by day and category. Download monthly
                  attachments.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-6">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} Expense Manager. All rights reserved.
        </div>
      </footer>
    </div>
  )
}
