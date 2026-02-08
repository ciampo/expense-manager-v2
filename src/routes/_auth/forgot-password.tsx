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

export const Route = createFileRoute('/_auth/forgot-password')({
  component: ForgotPasswordPage,
})

function ForgotPasswordPage() {
  const { signIn } = useAuthActions()
  const navigate = useNavigate()
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [isLoading, setIsLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState<{
    email?: string
    code?: string
    password?: string
    confirmPassword?: string
    form?: string
  }>({})

  // Step 1: request a reset code
  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrors({ email: 'Enter a valid email address' })
      return
    }

    setIsLoading(true)
    try {
      const formData = new FormData()
      formData.set('email', email)
      formData.set('flow', 'reset')

      await signIn('password', formData)
    } catch (error) {
      // Silently swallow -- never reveal whether the email exists
      // to prevent account-enumeration attacks.
      console.error('Password reset request error:', error)
    } finally {
      setIsLoading(false)
      // Always advance to the code step and show the same message
      // regardless of whether the account exists.
      toast('If an account with that email exists, a verification code was sent.')
      setStep('code')
    }
  }

  // Step 2: verify code and set new password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})

    const newErrors: typeof errors = {}
    if (!code.trim()) {
      newErrors.code = 'Enter the verification code'
    }
    if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters'
    }
    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match'
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setIsLoading(true)
    try {
      const formData = new FormData()
      formData.set('email', email)
      formData.set('code', code)
      formData.set('newPassword', password)
      formData.set('flow', 'reset-verification')

      await signIn('password', formData)
      toast.success('Password reset successfully')
      navigate({ to: '/sign-in' })
    } catch (error) {
      console.error('Password reset error:', error)
      const message =
        error instanceof Error && /expired|invalid/i.test(error.message)
          ? 'Code is invalid or expired. Please request a new one.'
          : 'Error resetting password. Please try again.'
      setErrors({ form: message })
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {step === 'email' ? 'Forgot password?' : 'Reset password'}
        </CardTitle>
        <CardDescription>
          {step === 'email'
            ? "Enter your email and we'll send you a verification code"
            : `Enter the code sent to ${email} and your new password`}
        </CardDescription>
      </CardHeader>

      {step === 'email' ? (
        <form onSubmit={handleRequestCode} noValidate>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                aria-describedby={errors.email ? 'email-error' : undefined}
                aria-invalid={!!errors.email}
              />
              {errors.email && (
                <p id="email-error" role="alert" className="text-sm text-destructive">
                  {errors.email}
                </p>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            {errors.form && (
              <p role="alert" className="text-sm text-destructive text-center">
                {errors.form}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Sending...' : 'Send verification code'}
            </Button>
            <Link
              to="/sign-in"
              className="text-sm text-primary underline hover:text-primary/80"
            >
              Back to sign in
            </Link>
          </CardFooter>
        </form>
      ) : (
        <form onSubmit={handleResetPassword} noValidate>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Verification code</Label>
              <Input
                id="code"
                type="text"
                inputMode="numeric"
                placeholder="8-digit code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={isLoading}
                autoComplete="one-time-code"
                aria-describedby={errors.code ? 'code-error' : undefined}
                aria-invalid={!!errors.code}
              />
              {errors.code && (
                <p id="code-error" role="alert" className="text-sm text-destructive">
                  {errors.code}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Minimum 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                aria-describedby={errors.password ? 'password-error' : undefined}
                aria-invalid={!!errors.password}
              />
              {errors.password && (
                <p id="password-error" role="alert" className="text-sm text-destructive">
                  {errors.password}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Repeat the password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isLoading}
                aria-describedby={
                  errors.confirmPassword ? 'confirm-password-error' : undefined
                }
                aria-invalid={!!errors.confirmPassword}
              />
              {errors.confirmPassword && (
                <p
                  id="confirm-password-error"
                  role="alert"
                  className="text-sm text-destructive"
                >
                  {errors.confirmPassword}
                </p>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            {errors.form && (
              <p role="alert" className="text-sm text-destructive text-center">
                {errors.form}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Resetting...' : 'Reset password'}
            </Button>
            <button
              type="button"
              onClick={() => {
                setStep('email')
                setCode('')
                setPassword('')
                setConfirmPassword('')
                setErrors({})
              }}
              className="text-sm text-primary underline hover:text-primary/80"
            >
              Use a different email
            </button>
          </CardFooter>
        </form>
      )}
    </Card>
  )
}
