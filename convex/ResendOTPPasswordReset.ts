import Resend from '@auth/core/providers/resend'
import { generateRandomString } from '@oslojs/crypto/random'

/**
 * Resend-based OTP provider for password reset emails.
 *
 * Uses the Resend HTTP API directly (via fetch) instead of the `resend`
 * npm SDK, because Convex functions run in a V8 runtime that does not
 * support Node.js built-in modules required by the SDK.
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
    // 8-digit numeric code
    return generateRandomString(
      { read: (bytes: Uint8Array) => crypto.getRandomValues(bytes) },
      '0123456789',
      8,
    )
  },

  async sendVerificationRequest({ identifier: email, provider, token }) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
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
      }),
    })

    if (!response.ok) {
      const body = await response.text()
      console.error('Resend API error:', response.status, body)
      throw new Error('Could not send password reset email')
    }
  },
})
