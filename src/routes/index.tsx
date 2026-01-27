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
          <div className="flex gap-2">
            <Button variant="ghost" asChild>
              <Link to="/sign-in">Accedi</Link>
            </Button>
            <Button asChild>
              <Link to="/sign-up">Registrati</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex items-center justify-center">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-4xl font-bold tracking-tight sm:text-5xl mb-6">
              Gestisci le tue spese di lavoro
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              Traccia facilmente le spese di coworking, pranzi e cene di lavoro.
              Genera report mensili e scarica i giustificativi in un click.
            </p>
            <div className="flex gap-4 justify-center">
              <Button size="lg" asChild>
                <Link to="/sign-up">Inizia gratis</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/sign-in">Accedi</Link>
              </Button>
            </div>
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-6 mt-16 max-w-4xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle>📊 Dashboard</CardTitle>
                <CardDescription>
                  Visualizza tutte le tue spese in un&apos;unica vista ordinata
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Tabella interattiva con filtri e ordinamento per data, importo
                  e categoria.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>📎 Allegati</CardTitle>
                <CardDescription>
                  Carica ricevute e fatture per ogni spesa
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Supporto per immagini e PDF fino a 10MB. Download multiplo in
                  formato ZIP.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>📄 Report</CardTitle>
                <CardDescription>
                  Genera report mensili pronti per la contabilità
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Export CSV raggruppato per giorno e categoria. Download
                  allegati del mese.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-6">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} Expense Manager. Tutti i diritti
          riservati.
        </div>
      </footer>
    </div>
  )
}
