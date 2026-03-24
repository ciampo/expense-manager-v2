export const CSP_REPORT_PATH = '/__csp-report'

export const SECURITY_HEADERS: Record<string, string> = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Reporting-Endpoints': `csp-endpoint="${CSP_REPORT_PATH}"`,
}

/**
 * Build an enforcing CSP header value. Uses a per-request nonce so that
 * TanStack Start's inline hydration scripts are allowed while
 * `'unsafe-inline'` is no longer needed for `script-src`.
 *
 * `'strict-dynamic'` lets nonced scripts load additional scripts (e.g.
 * Cloudflare Turnstile) without explicit host allowlists. The host
 * sources (`https://challenges.cloudflare.com`, `'self'`) are kept as
 * fallbacks for browsers that don't support `'strict-dynamic'`.
 *
 * `style-src` keeps `'unsafe-inline'` because component-level inline
 * styles (`style` attribute) cannot use nonces and are low-risk.
 */
export function buildCspHeader(nonce: string): string {
  if (!nonce || !/^[A-Za-z0-9+/]+=*$/.test(nonce)) {
    throw new Error('buildCspHeader: nonce must be a non-empty base64 string')
  }

  return [
    "default-src 'self'",
    `script-src 'strict-dynamic' 'nonce-${nonce}' 'self' https://challenges.cloudflare.com`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://*.convex.cloud",
    "font-src 'self'",
    "connect-src 'self' https://*.convex.cloud wss://*.convex.cloud https://challenges.cloudflare.com",
    'frame-src https://challenges.cloudflare.com',
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    'report-to csp-endpoint',
    `report-uri ${CSP_REPORT_PATH}`,
  ].join('; ')
}

export function addSecurityHeaders(response: Response): Response {
  const securedHeaders = new Headers(response.headers)
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    securedHeaders.set(name, value)
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: securedHeaders,
  })
}
