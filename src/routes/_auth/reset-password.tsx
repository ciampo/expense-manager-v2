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
      toast.error('Passwords do not match')
      return
    }

    if (password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }

    if (!code) {
      toast.error('Invalid link. Please request a new reset link.')
      return
    }

    setIsLoading(true)

    try {
      const formData = new FormData()
      formData.set('code', code)
      formData.set('newPassword', password)
      formData.set('flow', 'reset-verification')

      await signIn('password', formData)
      toast.success('Password reset successfully')
      navigate({ to: '/sign-in' })
    } catch (error) {
      console.error('Password reset error:', error)
      toast.error('Error resetting password. The link may have expired.')
    } finally {
      setIsLoading(false)
    }
  }

  if (!code) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Invalid link</CardTitle>
          <CardDescription>
            The password reset link is invalid or has expired.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Link
            to="/forgot-password"
            className="text-sm text-primary hover:underline"
          >
            Request a new link
          </Link>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reset password</CardTitle>
        <CardDescription>Enter your new password</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Minimum 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Repeat the password"
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
            {isLoading ? 'Saving...' : 'Reset password'}
          </Button>
          <Link to="/sign-in" className="text-sm text-primary hover:underline">
            ← Back to sign in
          </Link>
        </CardFooter>
      </form>
    </Card>
  )
}
