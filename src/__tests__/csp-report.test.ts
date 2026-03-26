import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CSP_REPORT_MAX_BODY_BYTES,
  CSP_REPORT_RATE_LIMIT_MAX,
  CSP_REPORT_RATE_LIMIT_WINDOW_MS,
  handleCspReport,
  resetCspRateLimiter,
} from '@/lib/csp-report'

const VALID_BODY = JSON.stringify({
  'csp-report': {
    'document-uri': 'https://example.com',
    'violated-directive': 'script-src',
    'blocked-uri': 'https://evil.com/bad.js',
  },
})

function makeRequest(
  options: {
    contentType?: string | null
    body?: string
    ip?: string
    contentLength?: string
  } = {},
): Request {
  const headers = new Headers()
  if (options.contentType !== undefined && options.contentType !== null) {
    headers.set('Content-Type', options.contentType)
  }
  if (options.ip) {
    headers.set('CF-Connecting-IP', options.ip)
  }
  if (options.contentLength !== undefined) {
    headers.set('Content-Length', options.contentLength)
  }

  return new Request('https://example.com/__csp-report', {
    method: 'POST',
    headers,
    body: options.body ?? VALID_BODY,
  })
}

describe('handleCspReport', () => {
  beforeEach(() => {
    resetCspRateLimiter()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // --- Content-Type validation ---

  describe('Content-Type validation', () => {
    it('accepts application/csp-report', async () => {
      const res = await handleCspReport(makeRequest({ contentType: 'application/csp-report' }))
      expect(res.status).toBe(204)
    })

    it('accepts application/reports+json', async () => {
      const res = await handleCspReport(makeRequest({ contentType: 'application/reports+json' }))
      expect(res.status).toBe(204)
    })

    it('accepts Content-Type with charset parameter', async () => {
      const res = await handleCspReport(
        makeRequest({ contentType: 'application/csp-report; charset=utf-8' }),
      )
      expect(res.status).toBe(204)
    })

    it('is case-insensitive for media type', async () => {
      const res = await handleCspReport(makeRequest({ contentType: 'Application/CSP-Report' }))
      expect(res.status).toBe(204)
    })

    it('rejects missing Content-Type with 415', async () => {
      const res = await handleCspReport(makeRequest({ contentType: null }))
      expect(res.status).toBe(415)
    })

    it('rejects application/json with 415', async () => {
      const res = await handleCspReport(makeRequest({ contentType: 'application/json' }))
      expect(res.status).toBe(415)
    })

    it('rejects text/plain with 415', async () => {
      const res = await handleCspReport(makeRequest({ contentType: 'text/plain' }))
      expect(res.status).toBe(415)
    })
  })

  // --- Rate limiting ---

  describe('rate limiting', () => {
    it('allows requests up to the limit', async () => {
      for (let i = 0; i < CSP_REPORT_RATE_LIMIT_MAX; i++) {
        const res = await handleCspReport(
          makeRequest({ contentType: 'application/csp-report', ip: '1.2.3.4' }),
        )
        expect(res.status).toBe(204)
      }
    })

    it('rejects the request exceeding the limit with 429', async () => {
      for (let i = 0; i < CSP_REPORT_RATE_LIMIT_MAX; i++) {
        await handleCspReport(makeRequest({ contentType: 'application/csp-report', ip: '1.2.3.4' }))
      }

      const res = await handleCspReport(
        makeRequest({ contentType: 'application/csp-report', ip: '1.2.3.4' }),
      )
      expect(res.status).toBe(429)
    })

    it('tracks IPs independently', async () => {
      for (let i = 0; i < CSP_REPORT_RATE_LIMIT_MAX; i++) {
        await handleCspReport(makeRequest({ contentType: 'application/csp-report', ip: '1.2.3.4' }))
      }

      const res = await handleCspReport(
        makeRequest({ contentType: 'application/csp-report', ip: '5.6.7.8' }),
      )
      expect(res.status).toBe(204)
    })

    it('resets after the time window expires', async () => {
      vi.useFakeTimers()

      for (let i = 0; i < CSP_REPORT_RATE_LIMIT_MAX; i++) {
        await handleCspReport(makeRequest({ contentType: 'application/csp-report', ip: '1.2.3.4' }))
      }

      const blocked = await handleCspReport(
        makeRequest({ contentType: 'application/csp-report', ip: '1.2.3.4' }),
      )
      expect(blocked.status).toBe(429)

      vi.advanceTimersByTime(CSP_REPORT_RATE_LIMIT_WINDOW_MS)

      const allowed = await handleCspReport(
        makeRequest({ contentType: 'application/csp-report', ip: '1.2.3.4' }),
      )
      expect(allowed.status).toBe(204)
    })

    it('falls back to "unknown" when CF-Connecting-IP is absent', async () => {
      for (let i = 0; i < CSP_REPORT_RATE_LIMIT_MAX; i++) {
        await handleCspReport(makeRequest({ contentType: 'application/csp-report' }))
      }

      const res = await handleCspReport(makeRequest({ contentType: 'application/csp-report' }))
      expect(res.status).toBe(429)
    })
  })

  // --- Body size limit ---

  describe('body size limit', () => {
    it('rejects when Content-Length exceeds the limit with 413', async () => {
      const res = await handleCspReport(
        makeRequest({
          contentType: 'application/csp-report',
          contentLength: String(CSP_REPORT_MAX_BODY_BYTES + 1),
        }),
      )
      expect(res.status).toBe(413)
    })

    it('rejects when actual streamed body exceeds the limit with 413', async () => {
      const oversized = 'x'.repeat(CSP_REPORT_MAX_BODY_BYTES + 1)
      const res = await handleCspReport(
        makeRequest({ contentType: 'application/csp-report', body: oversized }),
      )
      expect(res.status).toBe(413)
    })

    it('accepts a body at exactly the limit', async () => {
      const body = 'x'.repeat(CSP_REPORT_MAX_BODY_BYTES)
      const res = await handleCspReport(
        makeRequest({ contentType: 'application/csp-report', body }),
      )
      expect(res.status).toBe(204)
    })
  })

  // --- Normal operation ---

  describe('normal operation', () => {
    it('returns 204 with null body for valid reports', async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {})

      const res = await handleCspReport(makeRequest({ contentType: 'application/csp-report' }))
      expect(res.status).toBe(204)
      expect(res.body).toBeNull()
    })

    it('logs the parsed report', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await handleCspReport(makeRequest({ contentType: 'application/csp-report' }))

      expect(logSpy).toHaveBeenCalledWith('[CSP Report]', VALID_BODY)
    })

    it('returns 204 and warns for malformed JSON', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const res = await handleCspReport(
        makeRequest({ contentType: 'application/csp-report', body: 'not json' }),
      )

      expect(res.status).toBe(204)
      expect(warnSpy).toHaveBeenCalledWith('[CSP Report] Failed to parse report body')
    })
  })
})
