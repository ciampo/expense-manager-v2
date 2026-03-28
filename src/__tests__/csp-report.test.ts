import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CSP_REPORT_MAX_BODY_BYTES,
  CSP_REPORT_RATE_LIMIT_MAP_CAP,
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
    body?: BodyInit | null
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

  const body = options.body === undefined ? VALID_BODY : options.body
  const init: RequestInit = { method: 'POST', headers, body }
  if (body instanceof ReadableStream) {
    // @ts-expect-error -- duplex is required for streaming bodies but not yet in all TS lib types
    init.duplex = 'half'
  }
  return new Request('https://example.com/__csp-report', init)
}

/**
 * Build a ReadableStream body from a string. Unlike a plain string body,
 * the Request constructor won't auto-set a Content-Length header, so the
 * streaming path in readLimitedBody is exercised.
 */
function streamBody(text: string): ReadableStream<Uint8Array> {
  const encoded = new TextEncoder().encode(text)
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoded)
      controller.close()
    },
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

    it('rejects when no Content-Type is explicitly set (browser default) with 415', async () => {
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

    it('rejects the request exceeding the limit with 429 and Retry-After', async () => {
      for (let i = 0; i < CSP_REPORT_RATE_LIMIT_MAX; i++) {
        await handleCspReport(makeRequest({ contentType: 'application/csp-report', ip: '1.2.3.4' }))
      }

      const res = await handleCspReport(
        makeRequest({ contentType: 'application/csp-report', ip: '1.2.3.4' }),
      )
      expect(res.status).toBe(429)
      expect(res.headers.get('Retry-After')).toBe(
        String(Math.ceil(CSP_REPORT_RATE_LIMIT_WINDOW_MS / 1000)),
      )
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

    it('load-sheds new IPs when the map is at capacity with all-fresh entries', async () => {
      vi.useFakeTimers()

      for (let i = 0; i < CSP_REPORT_RATE_LIMIT_MAP_CAP; i++) {
        await handleCspReport(
          makeRequest({
            contentType: 'application/csp-report',
            ip: `10.0.${Math.floor(i / 256)}.${i % 256}`,
          }),
        )
      }

      const res = await handleCspReport(
        makeRequest({ contentType: 'application/csp-report', ip: '192.168.0.1' }),
      )
      expect(res.status).toBe(429)
    })

    it('evicts stale entries when the map reaches capacity', async () => {
      vi.useFakeTimers()

      for (let i = 0; i < CSP_REPORT_RATE_LIMIT_MAP_CAP; i++) {
        await handleCspReport(
          makeRequest({
            contentType: 'application/csp-report',
            ip: `10.0.${Math.floor(i / 256)}.${i % 256}`,
          }),
        )
      }

      vi.advanceTimersByTime(CSP_REPORT_RATE_LIMIT_WINDOW_MS)

      const res = await handleCspReport(
        makeRequest({ contentType: 'application/csp-report', ip: '192.168.0.1' }),
      )
      expect(res.status).toBe(204)
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

    it('rejects when streamed body exceeds the limit (no Content-Length) with 413', async () => {
      const oversized = 'x'.repeat(CSP_REPORT_MAX_BODY_BYTES + 1)
      const res = await handleCspReport(
        makeRequest({
          contentType: 'application/csp-report',
          body: streamBody(oversized),
        }),
      )
      expect(res.status).toBe(413)
    })

    it('accepts a streamed body at exactly the limit', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const body = 'x'.repeat(CSP_REPORT_MAX_BODY_BYTES)
      const res = await handleCspReport(
        makeRequest({ contentType: 'application/csp-report', body: streamBody(body) }),
      )
      expect(res.status).toBe(204)
      expect(warnSpy).toHaveBeenCalledWith('[CSP Report] Failed to parse report body')
    })

    it('falls through to streaming check when Content-Length is non-numeric', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const res = await handleCspReport(
        makeRequest({
          contentType: 'application/csp-report',
          contentLength: 'garbage',
        }),
      )
      expect(res.status).toBe(204)
      expect(warnSpy).not.toHaveBeenCalled()
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

    it('returns 204 and warns for empty body', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const res = await handleCspReport(
        makeRequest({ contentType: 'application/csp-report', body: null }),
      )

      expect(res.status).toBe(204)
      expect(warnSpy).toHaveBeenCalledWith('[CSP Report] Failed to parse report body')
    })
  })
})
