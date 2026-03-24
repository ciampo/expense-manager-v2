import { convexAuth } from '@convex-dev/auth/server'
import { Password } from '@convex-dev/auth/providers/Password'
import type { Value } from 'convex/values'
import { ResendOTPPasswordReset } from './ResendOTPPasswordReset'
import { isEmailAllowed, normalizeEmail, parseAllowedEmails } from './emailAllowlist'
import { formatRetryDelay, rateLimiter } from './rateLimits'
import { verifyTurnstileToken } from './turnstile'

// Wrap the Password provider's authorize function to validate Cloudflare
// Turnstile tokens before processing any auth request. The Password provider
// uses ConvexCredentials internally, which stores the real authorize in an
// `options` property (internal to @convex-dev/auth).
const passwordProvider = Password({ reset: ResendOTPPasswordReset })
const providerOptions = (passwordProvider as unknown as Record<string, unknown>).options as {
  authorize: (params: Record<string, Value | undefined>, ctx: unknown) => Promise<unknown>
}
const originalAuthorize = providerOptions.authorize
providerOptions.authorize = async (params, ctx) => {
  await verifyTurnstileToken(params.turnstileToken as string | undefined)
  return originalAuthorize(params, ctx)
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [passwordProvider],
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

        if (profile.email) {
          const { ok } = await rateLimiter.limit(ctx, 'signUp', {
            key: normalizeEmail(profile.email),
          })
          if (!ok) {
            throw new Error('Registration is not available')
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
