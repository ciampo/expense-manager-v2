import { convexAuth } from '@convex-dev/auth/server'
import { Password } from '@convex-dev/auth/providers/Password'
import { ResendOTPPasswordReset } from './ResendOTPPasswordReset'
import { isEmailAllowed, parseAllowedEmails } from './emailAllowlist'

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password({ reset: ResendOTPPasswordReset })],
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
    },
  },
})
