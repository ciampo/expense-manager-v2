import { RateLimiter, MINUTE, HOUR } from '@convex-dev/rate-limiter'
import { v } from 'convex/values'
import { components } from './_generated/api'
import { mutation } from './_generated/server'

export const rateLimiter = new RateLimiter(components.rateLimiter, {
  // Complements @convex-dev/auth's built-in maxFailedAttempsPerHour (failed-password brute-force).
  // This limiter caps successful session creation per account (credential-stuffing with valid creds).
  signIn: { kind: 'token bucket', rate: 5, period: MINUTE },
  // Auth: prevent mass account creation
  signUp: { kind: 'fixed window', rate: 3, period: HOUR },
  // Auth: client-side preflight to reduce OTP email spam from the official UI
  passwordReset: { kind: 'fixed window', rate: 3, period: HOUR },
  // Storage: prevent upload abuse
  fileUpload: { kind: 'token bucket', rate: 10, period: MINUTE },
})

/**
 * Consume a password-reset rate limit token for the given email.
 *
 * `@convex-dev/auth` sends the OTP email inside its `signIn` action before any
 * mutation callback we can intercept. Because of this, the rate limit here is
 * enforced only as a client-side preflight: the first-party client calls this
 * mutation *before* initiating the reset and aborts if it throws. A custom
 * client could bypass this check by calling the `signIn` reset flow directly.
 *
 * This is a defense-in-depth measure for the official UI. Server-side
 * protection against repeated failed attempts is provided by
 * `@convex-dev/auth`'s built-in `signIn.maxFailedAttempsPerHour`.
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
