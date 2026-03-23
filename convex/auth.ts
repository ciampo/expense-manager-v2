import { convexAuth } from '@convex-dev/auth/server'
import { Password } from '@convex-dev/auth/providers/Password'
import { ResendOTPPasswordReset } from './ResendOTPPasswordReset'

function parseAllowedEmails(): string[] {
  return (process.env.ALLOWED_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

function isEmailAllowed(email: string | undefined, allowedEmails: string[]): boolean {
  if (allowedEmails.length === 0) return true
  if (!email) return false
  const normalized = email.toLowerCase()
  return allowedEmails.some((entry) =>
    entry.startsWith('*@') ? normalized.endsWith(entry.slice(1)) : normalized === entry,
  )
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password({ reset: ResendOTPPasswordReset })],
  callbacks: {
    async createOrUpdateUser(ctx, { existingUserId, profile }) {
      if (!existingUserId) {
        if (process.env.REGISTRATION_ENABLED === 'false') {
          throw new Error('Registration is currently disabled')
        }

        const allowed = parseAllowedEmails()
        if (!isEmailAllowed(profile.email, allowed)) {
          throw new Error('Registration is not available')
        }
      }

      const {
        emailVerified: profileEmailVerified,
        phoneVerified: profilePhoneVerified,
        ...profileData
      } = profile

      if (existingUserId) {
        await ctx.db.patch(existingUserId, {
          ...(profileEmailVerified ? { emailVerificationTime: Date.now() } : null),
          ...(profilePhoneVerified ? { phoneVerificationTime: Date.now() } : null),
          ...profileData,
        })
        return existingUserId
      }

      return await ctx.db.insert('users', {
        ...(profileEmailVerified ? { emailVerificationTime: Date.now() } : null),
        ...(profilePhoneVerified ? { phoneVerificationTime: Date.now() } : null),
        ...profileData,
      })
    },

    async beforeSessionCreation(ctx, { userId }) {
      const user = await ctx.db.get(userId)
      if (!user) throw new Error('User not found')

      const allowed = parseAllowedEmails()
      const email = typeof user.email === 'string' ? user.email : undefined
      if (!isEmailAllowed(email, allowed)) {
        throw new Error('Access denied')
      }
    },
  },
})
