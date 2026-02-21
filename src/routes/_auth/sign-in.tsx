import { createFileRoute, Link } from '@tanstack/react-router'
import { useAuthActions } from '@convex-dev/auth/react'
import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
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

export const Route = createFileRoute('/_auth/sign-in')({
  component: SignInPage,
})

const signInSchema = z.object({
  email: z.string().min(1, { message: 'Email is required.' }).email({ message: 'Enter a valid email address.' }),
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
        toast.error('Invalid email or password')
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
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
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
                  aria-invalid={field.state.meta.errors.length > 0}
                  aria-describedby={
                    field.state.meta.errors.length ? 'email-error' : undefined
                  }
                />
                {field.state.meta.errors.length > 0 && (
                  <p id="email-error" role="alert" className="text-sm text-destructive">
                    {field.state.meta.errors.map((e) => e?.message).join(', ')}
                  </p>
                )}
              </div>
            )}
          </form.Field>
          <form.Field name="password">
            {(field) => (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    to="/forgot-password"
                    className="text-sm text-muted-foreground underline hover:text-primary"
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
                  aria-invalid={field.state.meta.errors.length > 0}
                  aria-describedby={
                    field.state.meta.errors.length ? 'password-error' : undefined
                  }
                />
                {field.state.meta.errors.length > 0 && (
                  <p id="password-error" role="alert" className="text-sm text-destructive">
                    {field.state.meta.errors.map((e) => e?.message).join(', ')}
                  </p>
                )}
              </div>
            )}
          </form.Field>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          {serverError && (
            <p role="alert" className="text-sm text-destructive text-center">
              {serverError}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={form.state.isSubmitting}>
            {form.state.isSubmitting ? 'Signing in...' : 'Sign In'}
          </Button>
          <p className="text-sm text-muted-foreground text-center">
            Don&apos;t have an account?{' '}
            <Link to="/sign-up" className="text-primary underline hover:text-primary/80">
              Sign Up
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
