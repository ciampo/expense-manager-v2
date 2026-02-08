import Resend from '@auth/core/providers/resend'
import { Resend as ResendAPI } from 'resend'
import { RandomReader, generateRandomString } from '@oslojs/crypto/random'

/**
 * Resend-based OTP provider for password reset emails.
 *
 * Requires the AUTH_RESEND_KEY environment variable to be set in Convex:
 *   npx convex env set AUTH_RESEND_KEY <your-resend-api-key>
 *
 * During development you can use Resend's free tier with the
 * onboarding@resend.dev sender. For production, verify your domain
 * in the Resend dashboard and update the `from` address below.
 */
export const ResendOTPPasswordReset = Resend({
  id: 'resend-otp',
  apiKey: process.env.AUTH_RESEND_KEY,

  async generateVerificationToken() {
    const random: RandomReader = {
      read(bytes) {
        crypto.getRandomValues(bytes)
      },
    }
    // 8-digit numeric code
    return generateRandomString(random, '0123456789', 8)
  },

  async sendVerificationRequest({ identifier: email, provider, token }) {
    const resend = new ResendAPI(provider.apiKey)
    const { error } = await resend.emails.send({
      from: 'Expense Manager <onboarding@resend.dev>',
      to: [email],
      subject: 'Reset your Expense Manager password',
      text: [
        'You requested a password reset for your Expense Manager account.',
        '',
        `Your verification code is: ${token}`,
        '',
        'If you did not request this, you can safely ignore this email.',
      ].join('\n'),
    })

    if (error) {
      throw new Error('Could not send password reset email')
    }
  },
})
