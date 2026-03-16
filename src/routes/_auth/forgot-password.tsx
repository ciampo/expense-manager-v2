import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useAuthActions } from '@convex-dev/auth/react'
import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import { emailSchema, passwordSchema } from '@/lib/schemas'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
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
  head: () => ({
    meta: [{ title: 'Reset Password — Expense Manager' }],
  }),
})

const requestCodeSchema = z.object({
  email: emailSchema,
})

const resetPasswordSchema = z
  .object({
    code: z.string().min(1, { message: 'Enter the verification code.' }),
    password: passwordSchema,
    confirmPassword: z.string().min(1, { message: 'Confirm your password.' }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  })

function ForgotPasswordPage() {
  const { signIn } = useAuthActions()
  const navigate = useNavigate()
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')

  if (step === 'email') {
    return (
      <EmailStep
        signIn={signIn}
        onSuccess={(e) => {
          setEmail(e)
          setStep('code')
        }}
      />
    )
  }

  return (
    <CodeStep
      signIn={signIn}
      email={email}
      onBack={() => setStep('email')}
      onSuccess={() => navigate({ to: '/sign-in' })}
    />
  )
}

function EmailStep({
  signIn,
  onSuccess,
}: {
  signIn: ReturnType<typeof useAuthActions>['signIn']
  onSuccess: (email: string) => void
}) {
  const form = useForm({
    defaultValues: { email: '' },
    validators: { onSubmit: requestCodeSchema },
    onSubmit: async ({ value }) => {
      try {
        const formData = new FormData()
        formData.set('email', value.email)
        formData.set('flow', 'reset')
        await signIn('password', formData)
      } catch (error) {
        // Silently swallow — never reveal whether the email exists
        // to prevent account-enumeration attacks.
        console.error('Password reset request error:', error)
      } finally {
        toast('If an account with that email exists, a verification code was sent.')
        onSuccess(value.email)
      }
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1>Forgot password?</h1>
        </CardTitle>
        <CardDescription>
          Enter your email and we&apos;ll send you a verification code
        </CardDescription>
      </CardHeader>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          form.handleSubmit()
        }}
        noValidate
      >
        <CardContent className="space-y-4">
          <form.Field name="email">
            {(field) => {
              const hasErrors = field.state.meta.errors.length > 0
              return (
                <Field data-invalid={hasErrors || undefined}>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    required
                    disabled={form.state.isSubmitting}
                    autoComplete="email"
                    aria-invalid={hasErrors}
                    aria-describedby={hasErrors ? 'email-error' : undefined}
                  />
                  <FieldError id="email-error" errors={field.state.meta.errors} />
                </Field>
              )
            }}
          </form.Field>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full" disabled={form.state.isSubmitting}>
            {form.state.isSubmitting ? 'Sending...' : 'Send verification code'}
          </Button>
          <Link
            to="/sign-in"
            disabled={form.state.isSubmitting}
            className="text-primary hover:text-primary/80 text-sm underline aria-disabled:pointer-events-none aria-disabled:opacity-50"
          >
            Back to sign in
          </Link>
        </CardFooter>
      </form>
    </Card>
  )
}

function CodeStep({
  signIn,
  email,
  onBack,
  onSuccess,
}: {
  signIn: ReturnType<typeof useAuthActions>['signIn']
  email: string
  onBack: () => void
  onSuccess: () => void
}) {
  const [serverError, setServerError] = useState('')

  const form = useForm({
    defaultValues: { code: '', password: '', confirmPassword: '' },
    validators: { onSubmit: resetPasswordSchema },
    onSubmit: async ({ value }) => {
      setServerError('')

      try {
        const formData = new FormData()
        formData.set('email', email)
        formData.set('code', value.code)
        formData.set('newPassword', value.password)
        formData.set('flow', 'reset-verification')

        await signIn('password', formData)
        toast.success('Password reset successfully')
        onSuccess()
      } catch (error) {
        console.error('Password reset error:', error)
        const message =
          error instanceof Error && /expired|invalid/i.test(error.message)
            ? 'Code is invalid or expired. Please request a new one.'
            : 'Error resetting password. Please try again.'
        setServerError(message)
      }
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1>Reset password</h1>
        </CardTitle>
        <CardDescription>Enter the code sent to {email} and your new password</CardDescription>
      </CardHeader>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          form.handleSubmit()
        }}
        noValidate
      >
        <CardContent className="space-y-4">
          <form.Field name="code">
            {(field) => {
              const hasErrors = field.state.meta.errors.length > 0
              return (
                <Field data-invalid={hasErrors || undefined}>
                  <FieldLabel htmlFor="code">Verification code</FieldLabel>
                  <Input
                    id="code"
                    type="text"
                    inputMode="numeric"
                    placeholder="8-digit code"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    required
                    disabled={form.state.isSubmitting}
                    autoComplete="one-time-code"
                    aria-invalid={hasErrors}
                    aria-describedby={hasErrors ? 'code-error' : undefined}
                  />
                  <FieldError id="code-error" errors={field.state.meta.errors} />
                </Field>
              )
            }}
          </form.Field>
          <form.Field name="password">
            {(field) => {
              const hasErrors = field.state.meta.errors.length > 0
              return (
                <Field data-invalid={hasErrors || undefined}>
                  <FieldLabel htmlFor="password">New password</FieldLabel>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Minimum 8 characters"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    required
                    disabled={form.state.isSubmitting}
                    autoComplete="new-password"
                    aria-invalid={hasErrors}
                    aria-describedby={hasErrors ? 'password-error' : undefined}
                  />
                  <FieldError id="password-error" errors={field.state.meta.errors} />
                </Field>
              )
            }}
          </form.Field>
          <form.Field name="confirmPassword">
            {(field) => {
              const hasErrors = field.state.meta.errors.length > 0
              return (
                <Field data-invalid={hasErrors || undefined}>
                  <FieldLabel htmlFor="confirmPassword">Confirm new password</FieldLabel>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Repeat the password"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    required
                    disabled={form.state.isSubmitting}
                    autoComplete="new-password"
                    aria-invalid={hasErrors}
                    aria-describedby={hasErrors ? 'confirm-password-error' : undefined}
                  />
                  <FieldError id="confirm-password-error" errors={field.state.meta.errors} />
                </Field>
              )
            }}
          </form.Field>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <FieldError
            errors={serverError ? [{ message: serverError }] : undefined}
            className="text-center"
          />
          <Button type="submit" className="w-full" disabled={form.state.isSubmitting}>
            {form.state.isSubmitting ? 'Resetting...' : 'Reset password'}
          </Button>
          <button
            type="button"
            onClick={onBack}
            disabled={form.state.isSubmitting}
            className="text-primary hover:text-primary/80 text-sm underline disabled:pointer-events-none disabled:opacity-50"
          >
            Use a different email
          </button>
        </CardFooter>
      </form>
    </Card>
  )
}
