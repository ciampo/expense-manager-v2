import { createFileRoute, Link } from '@tanstack/react-router'
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

export const Route = createFileRoute('/_auth/sign-up')({
  component: SignUpPage,
})

const signUpSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, { message: 'Confirm your password.' }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  })

function SignUpPage() {
  const { signIn } = useAuthActions()
  const [serverError, setServerError] = useState('')

  const form = useForm({
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
    },
    validators: {
      onSubmit: signUpSchema,
    },
    onSubmit: async ({ value }) => {
      setServerError('')

      try {
        const formData = new FormData()
        formData.set('email', value.email)
        formData.set('password', value.password)
        formData.set('flow', 'signUp')

        await signIn('password', formData)
        toast.success('Account created successfully')
      } catch (error) {
        console.error('Sign up error:', error)
        const message =
          error instanceof Error && /already exists/i.test(error.message)
            ? 'An account with this email already exists. Try signing in instead.'
            : 'Error during registration. Please try again.'
        setServerError(message)
        toast.error(message)
      }
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign Up</CardTitle>
        <CardDescription>Create a new account to start managing your expenses</CardDescription>
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
                  <FieldLabel htmlFor="password">Password</FieldLabel>
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
                  <FieldLabel htmlFor="confirmPassword">Confirm password</FieldLabel>
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
            {form.state.isSubmitting ? 'Signing up...' : 'Sign Up'}
          </Button>
          <p className="text-muted-foreground text-center text-sm">
            Already have an account?{' '}
            <Link to="/sign-in" className="text-primary hover:text-primary/80 underline">
              Sign In
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
