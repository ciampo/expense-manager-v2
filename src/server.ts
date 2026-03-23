import handler, { createServerEntry } from '@tanstack/react-start/server-entry'

const SECURITY_HEADERS: Record<string, string> = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  // Report-Only during initial rollout — switch to Content-Security-Policy
  // once monitoring confirms no false positives.
  'Content-Security-Policy-Report-Only': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://*.convex.cloud",
    "font-src 'self'",
    "connect-src 'self' https://*.convex.cloud wss://*.convex.cloud",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '),
}

export default createServerEntry({
  async fetch(request) {
    const response = await handler.fetch(request)

    const securedHeaders = new Headers(response.headers)
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      securedHeaders.set(name, value)
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: securedHeaders,
    })
  },
})
