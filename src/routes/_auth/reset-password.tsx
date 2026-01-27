import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
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

export const Route = createFileRoute('/_auth/reset-password')({
  component: ResetPasswordPage,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      code: (search.code as string) || '',
    }
  },
})

function ResetPasswordPage() {
  const { signIn } = useAuthActions()
  const navigate = useNavigate()
  const { code } = Route.useSearch()
  const [isLoading, setIsLoading] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (password !== confirmPassword) {
      toast.error('Le password non coincidono')
      return
    }

    if (password.length < 8) {
      toast.error('La password deve essere di almeno 8 caratteri')
      return
    }

    if (!code) {
      toast.error('Link non valido. Richiedi un nuovo link di reset.')
      return
    }

    setIsLoading(true)

    try {
      const formData = new FormData()
      formData.set('code', code)
      formData.set('newPassword', password)
      formData.set('flow', 'reset-verification')

      await signIn('password', formData)
      toast.success('Password reimpostata con successo')
      navigate({ to: '/sign-in' })
    } catch (error) {
      console.error('Password reset error:', error)
      toast.error('Errore durante il reset della password. Il link potrebbe essere scaduto.')
    } finally {
      setIsLoading(false)
    }
  }

  if (!code) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Link non valido</CardTitle>
          <CardDescription>
            Il link per reimpostare la password non è valido o è scaduto.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Link
            to="/forgot-password"
            className="text-sm text-primary hover:underline"
          >
            Richiedi un nuovo link
          </Link>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reimposta password</CardTitle>
        <CardDescription>Inserisci la tua nuova password</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Nuova password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Minimo 8 caratteri"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Conferma password</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Ripeti la password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              disabled={isLoading}
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Salvataggio in corso...' : 'Reimposta password'}
          </Button>
          <Link to="/sign-in" className="text-sm text-primary hover:underline">
            ← Torna al login
          </Link>
        </CardFooter>
      </form>
    </Card>
  )
}
