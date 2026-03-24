const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

interface SiteverifyResponse {
  success: boolean
  'error-codes'?: string[]
}

/**
 * Validates a Cloudflare Turnstile token against the siteverify API.
 *
 * Graceful degradation: when `TURNSTILE_SECRET_KEY` is not set (e.g. local
 * development), validation is skipped entirely so developers don't need
 * Turnstile keys to work locally.
 */
export async function verifyTurnstileToken(token: string | undefined): Promise<void> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY
  if (!secretKey) return

  if (!token) {
    throw new Error('Bot verification required')
  }

  const response = await fetch(SITEVERIFY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      secret: secretKey,
      response: token,
    }),
  })

  if (!response.ok) {
    console.error('Turnstile siteverify HTTP error', {
      status: response.status,
      statusText: response.statusText,
    })
    throw new Error('Bot verification failed')
  }

  let data: SiteverifyResponse
  try {
    data = (await response.json()) as SiteverifyResponse
  } catch (parseError) {
    console.error('Turnstile siteverify response parse error', parseError)
    throw new Error('Bot verification failed', { cause: parseError })
  }

  if (!data.success) {
    throw new Error('Bot verification failed')
  }
}
