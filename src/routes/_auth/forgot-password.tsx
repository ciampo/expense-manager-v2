import { createFileRoute, Link } from '@tanstack/react-router'
import { useAuthActions } from '@convex-dev/auth/react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { toast } from 'sonner'

export const Route = createFileRoute('/_auth/forgot-password')({
  component: ForgotPasswordPage,
})

function ForgotPasswordPage() {
  const { signIn } = useAuthActions()
  const [isLoading, setIsLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const formData = new FormData()
      formData.set('email', email)
      formData.set('flow', 'reset')

      await signIn('password', formData)
      setSubmitted(true)
      toast.success('Email inviata')
    } catch (error) {
      console.error('Password reset error:', error)
      toast.error('Errore durante l\'invio dell\'email')
    } finally {
      setIsLoading(false)
    }
  }

  if (submitted) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Controlla la tua email</CardTitle>
          <CardDescription>
            Abbiamo inviato le istruzioni per reimpostare la password a{' '}
            <strong>{email}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Se non ricevi l&apos;email entro qualche minuto, controlla la
            cartella spam o{' '}
            <button
              onClick={() => setSubmitted(false)}
              className="text-primary hover:underline"
            >
              riprova
            </button>
            .
          </p>
        </CardContent>
        <CardFooter>
          <Link to="/sign-in" className="text-sm text-primary hover:underline">
            ← Torna al login
          </Link>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Password dimenticata?</CardTitle>
        <CardDescription>
          Inserisci la tua email e ti invieremo le istruzioni per reimpostare la
          password
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="nome@esempio.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Invio in corso...' : 'Invia istruzioni'}
          </Button>
          <Link to="/sign-in" className="text-sm text-primary hover:underline">
            ← Torna al login
          </Link>
        </CardFooter>
      </form>
    </Card>
  )
}
