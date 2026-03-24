import { RateLimiter, MINUTE, HOUR } from '@convex-dev/rate-limiter'
import { v } from 'convex/values'
import { components } from './_generated/api'
import { mutation } from './_generated/server'

export const rateLimiter = new RateLimiter(components.rateLimiter, {
  // Auth: cap session creation per account (credential-stuffing with valid creds).
  // Failed-password brute-force is handled by @convex-dev/auth's maxFailedAttempsPerHour.
  signIn: { kind: 'token bucket', rate: 5, period: MINUTE },
  // Auth: prevent mass account creation
  signUp: { kind: 'fixed window', rate: 3, period: HOUR },
  // Auth: prevent OTP email spam (Resend has per-email costs)
  passwordReset: { kind: 'fixed window', rate: 3, period: HOUR },
  // Storage: prevent upload abuse
  fileUpload: { kind: 'token bucket', rate: 10, period: MINUTE },
})

/**
 * Consume a password-reset rate limit token for the given email.
 *
 * The password-reset flow in `@convex-dev/auth` sends the OTP email inside the
 * `signIn` action before any mutation callback we can intercept. To rate-limit
 * the email-sending step, the client calls this mutation *before* initiating
 * the reset. If the limit is exceeded, the mutation throws and the client
 * should not proceed with the reset request.
 *
 * This is a defense-in-depth measure: `@convex-dev/auth`'s built-in
 * `signIn.maxFailedAttempsPerHour` provides a secondary server-side cap.
 */
export const consumePasswordResetRateLimit = mutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const normalizedEmail = email.trim().toLowerCase()
    const { ok, retryAfter } = await rateLimiter.limit(ctx, 'passwordReset', {
      key: normalizedEmail,
    })
    if (!ok) {
      const minutes = Math.ceil(retryAfter / 1000 / 60)
      throw new Error(
        `Too many password reset attempts. Please try again in ${minutes} minute${minutes !== 1 ? 's' : ''}.`,
      )
    }
  },
})
