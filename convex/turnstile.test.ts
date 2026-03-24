// @vitest-environment node
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest'
import { verifyTurnstileToken } from './turnstile'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const mockFetch = vi.fn<typeof fetch>()

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch)
  vi.stubEnv('TURNSTILE_SECRET_KEY', 'test-secret-key')
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  mockFetch.mockReset()
})

describe('verifyTurnstileToken', () => {
  it('skips validation when TURNSTILE_SECRET_KEY is unset', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', '')
    await expect(verifyTurnstileToken(undefined)).resolves.toBeUndefined()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('throws when token is undefined and secret key is set', async () => {
    await expect(verifyTurnstileToken(undefined)).rejects.toThrow('Bot verification required')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('throws when token is empty string and secret key is set', async () => {
    await expect(verifyTurnstileToken('')).rejects.toThrow('Bot verification required')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('resolves when siteverify returns success', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ success: true }))
    await expect(verifyTurnstileToken('valid-token')).resolves.toBeUndefined()
  })

  it('sends correct payload to siteverify', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ success: true }))
    await verifyTurnstileToken('my-token')

    expect(mockFetch).toHaveBeenCalledWith(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: 'test-secret-key', response: 'my-token' }),
      },
    )
  })

  it('throws when siteverify returns success: false', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ success: false, 'error-codes': ['invalid-input-response'] }),
    )
    await expect(verifyTurnstileToken('bad-token')).rejects.toThrow('Bot verification failed')
  })

  it('throws when siteverify returns non-2xx status', async () => {
    mockFetch.mockResolvedValueOnce(new Response('Internal Server Error', { status: 500 }))
    await expect(verifyTurnstileToken('some-token')).rejects.toThrow('Bot verification failed')
  })

  it('throws with cause when siteverify returns non-JSON body', async () => {
    mockFetch.mockResolvedValueOnce(new Response('not json', { status: 200 }))
    await expect(verifyTurnstileToken('some-token')).rejects.toSatisfy((error: Error) => {
      expect(error.message).toBe('Bot verification failed')
      expect(error.cause).toBeDefined()
      return true
    })
  })
})
