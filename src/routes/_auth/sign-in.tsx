import { createFileRoute, Link } from '@tanstack/react-router'
import { useAuthActions } from '@convex-dev/auth/react'
import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import { emailSchema } from '@/lib/schemas'
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

export const Route = createFileRoute('/_auth/sign-in')({
  component: SignInPage,
})

const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { message: 'Password is required.' }),
})

function SignInPage() {
  const { signIn } = useAuthActions()
  const [serverError, setServerError] = useState('')

  const form = useForm({
    defaultValues: {
      email: '',
      password: '',
    },
    validators: {
      onSubmit: signInSchema,
    },
    onSubmit: async ({ value }) => {
      setServerError('')

      try {
        const formData = new FormData()
        formData.set('email', value.email)
        formData.set('password', value.password)
        formData.set('flow', 'signIn')

        await signIn('password', formData)
        toast.success('Signed in successfully')
        // No explicit navigate() needed: AuthBridge detects the auth state
        // change and calls router.invalidate(), which re-runs _auth's
        // beforeLoad — that guard sees isAuthenticated: true and redirects
        // to /dashboard automatically.
      } catch (error) {
        console.error('Sign in error:', error)
        setServerError('Invalid email or password')
      }
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign In</CardTitle>
        <CardDescription>Enter your credentials to sign in</CardDescription>
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
          <form.Field name="password">
            {(field) => {
              const hasErrors = field.state.meta.errors.length > 0
              return (
                <Field data-invalid={hasErrors || undefined}>
                  <div className="flex items-center justify-between">
                    <FieldLabel htmlFor="password">Password</FieldLabel>
                    <Link
                      to="/forgot-password"
                      disabled={form.state.isSubmitting}
                      className="text-muted-foreground hover:text-primary text-sm underline aria-disabled:pointer-events-none aria-disabled:opacity-50"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    required
                    disabled={form.state.isSubmitting}
                    autoComplete="current-password"
                    aria-invalid={hasErrors}
                    aria-describedby={hasErrors ? 'password-error' : undefined}
                  />
                  <FieldError id="password-error" errors={field.state.meta.errors} />
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
            {form.state.isSubmitting ? 'Signing in...' : 'Sign In'}
          </Button>
          <p className="text-muted-foreground text-center text-sm">
            Don&apos;t have an account?{' '}
            <Link
              to="/sign-up"
              disabled={form.state.isSubmitting}
              className="text-primary hover:text-primary/80 underline aria-disabled:pointer-events-none aria-disabled:opacity-50"
            >
              Sign Up
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
