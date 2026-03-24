import { describe, it, expect } from 'vitest'
import {
  SECURITY_HEADERS,
  CSP_REPORT_PATH,
  buildCspHeader,
  addSecurityHeaders,
} from '@/lib/security-headers'

const TEST_NONCE = 'dGVzdC1ub25jZQ=='

describe('SECURITY_HEADERS', () => {
  it('defines all expected header names', () => {
    const names = Object.keys(SECURITY_HEADERS)
    expect(names).toContain('Strict-Transport-Security')
    expect(names).toContain('X-Content-Type-Options')
    expect(names).toContain('X-Frame-Options')
    expect(names).toContain('Referrer-Policy')
    expect(names).toContain('Permissions-Policy')
    expect(names).toContain('Reporting-Endpoints')
  })

  it('does not include CSP in static headers (set per-request via middleware)', () => {
    const names = Object.keys(SECURITY_HEADERS)
    expect(names).not.toContain('Content-Security-Policy')
    expect(names).not.toContain('Content-Security-Policy-Report-Only')
  })

  it('configures Reporting-Endpoints header pointing to CSP_REPORT_PATH', () => {
    expect(SECURITY_HEADERS['Reporting-Endpoints']).toBe(`csp-endpoint="${CSP_REPORT_PATH}"`)
  })

  it('includes preload in HSTS header', () => {
    expect(SECURITY_HEADERS['Strict-Transport-Security']).toContain('preload')
  })
})

describe('buildCspHeader', () => {
  it('embeds the nonce in script-src', () => {
    const csp = buildCspHeader(TEST_NONCE)
    expect(csp).toContain(`'nonce-${TEST_NONCE}'`)
  })

  it('uses strict-dynamic for script-src', () => {
    const csp = buildCspHeader(TEST_NONCE)
    expect(csp).toMatch(/script-src[^;]*'strict-dynamic'/)
  })

  it('does not include unsafe-inline in script-src', () => {
    const csp = buildCspHeader(TEST_NONCE)
    const scriptSrc = csp.split(';').find((d) => d.trim().startsWith('script-src'))
    expect(scriptSrc).not.toContain('unsafe-inline')
  })

  it('includes Convex origins in connect-src', () => {
    const csp = buildCspHeader(TEST_NONCE)
    expect(csp).toContain('https://*.convex.cloud')
    expect(csp).toContain('wss://*.convex.cloud')
  })

  it('includes Turnstile origin in script-src and frame-src', () => {
    const csp = buildCspHeader(TEST_NONCE)
    expect(csp).toMatch(/script-src[^;]*https:\/\/challenges\.cloudflare\.com/)
    expect(csp).toMatch(/frame-src[^;]*https:\/\/challenges\.cloudflare\.com/)
  })

  it('includes frame-ancestors for clickjacking protection', () => {
    const csp = buildCspHeader(TEST_NONCE)
    expect(csp).toContain("frame-ancestors 'none'")
  })

  it('includes report-to and report-uri directives', () => {
    const csp = buildCspHeader(TEST_NONCE)
    expect(csp).toContain('report-to csp-endpoint')
    expect(csp).toContain(`report-uri ${CSP_REPORT_PATH}`)
  })
})

describe('addSecurityHeaders', () => {
  it('adds all security headers to a response', () => {
    const original = new Response('hello', {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    })

    const secured = addSecurityHeaders(original)

    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      expect(secured.headers.get(name)).toBe(value)
    }
  })

  it('preserves the original response body and status', async () => {
    const original = new Response('test body', { status: 201, statusText: 'Created' })

    const secured = addSecurityHeaders(original)

    expect(secured.status).toBe(201)
    expect(secured.statusText).toBe('Created')
    expect(await secured.text()).toBe('test body')
  })

  it('preserves existing headers from the original response', () => {
    const original = new Response(null, {
      headers: { 'X-Custom': 'keep-me' },
    })

    const secured = addSecurityHeaders(original)

    expect(secured.headers.get('X-Custom')).toBe('keep-me')
  })

  it('overwrites conflicting upstream headers', () => {
    const original = new Response(null, {
      headers: { 'X-Frame-Options': 'SAMEORIGIN' },
    })

    const secured = addSecurityHeaders(original)

    expect(secured.headers.get('X-Frame-Options')).toBe('DENY')
  })

  it('does not set or remove a Content-Security-Policy header', () => {
    const withCsp = new Response(null, {
      headers: { 'Content-Security-Policy': 'existing-policy' },
    })

    const secured = addSecurityHeaders(withCsp)

    expect(secured.headers.get('Content-Security-Policy')).toBe('existing-policy')
  })
})
