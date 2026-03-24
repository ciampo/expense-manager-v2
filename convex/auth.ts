import { convexAuth } from '@convex-dev/auth/server'
import { Password } from '@convex-dev/auth/providers/Password'
import { ResendOTPPasswordReset } from './ResendOTPPasswordReset'
import { isEmailAllowed, parseAllowedEmails } from './emailAllowlist'
import { rateLimiter } from './rateLimits'

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password({ reset: ResendOTPPasswordReset })],
  signIn: {
    maxFailedAttempsPerHour: 10,
  },
  callbacks: {
    async createOrUpdateUser(ctx, { existingUserId, profile }) {
      if (!existingUserId) {
        if (process.env.REGISTRATION_ENABLED === 'false') {
          throw new Error('Registration is not available')
        }

        const allowed = parseAllowedEmails()
        if (!isEmailAllowed(profile.email, allowed)) {
          throw new Error('Registration is not available')
        }

        const email = (profile as { email?: string }).email
        if (email) {
          const { ok, retryAfter } = await rateLimiter.limit(ctx, 'signUp', {
            key: normalizeEmail(email),
          })
          if (!ok) {
            throw new Error(
              `Too many sign-up attempts. Please try again in ${formatRetryDelay(retryAfter)}.`,
            )
          }
        }
      }

      const {
        emailVerified: profileEmailVerified,
        phoneVerified: profilePhoneVerified,
        ...profileData
      } = profile

      if (existingUserId) {
        await ctx.db.patch(existingUserId, {
          ...(profileEmailVerified ? { emailVerificationTime: Date.now() } : {}),
          ...(profilePhoneVerified ? { phoneVerificationTime: Date.now() } : {}),
          ...profileData,
        })
        return existingUserId
      }

      return await ctx.db.insert('users', {
        ...(profileEmailVerified ? { emailVerificationTime: Date.now() } : {}),
        ...(profilePhoneVerified ? { phoneVerificationTime: Date.now() } : {}),
        ...profileData,
      })
    },

    async beforeSessionCreation(ctx, { userId }) {
      const user = await ctx.db.get(userId)
      if (!user) throw new Error('Access denied')

      const allowed = parseAllowedEmails()
      const email = typeof user.email === 'string' ? user.email : undefined
      if (!isEmailAllowed(email, allowed)) {
        throw new Error('Access denied')
      }

      if (email) {
        const { ok, retryAfter } = await rateLimiter.limit(ctx, 'signIn', {
          key: normalizeEmail(email),
        })
        if (!ok) {
          throw new Error(
            `Too many sign-in attempts. Please try again in ${formatRetryDelay(retryAfter)}.`,
          )
        }
      }
    },
  },
})

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function formatRetryDelay(retryAfterMs: number): string {
  const seconds = Math.ceil(retryAfterMs / 1000)
  if (seconds < 60) return `${seconds} second${seconds !== 1 ? 's' : ''}`
  const minutes = Math.ceil(seconds / 60)
  return `${minutes} minute${minutes !== 1 ? 's' : ''}`
}
