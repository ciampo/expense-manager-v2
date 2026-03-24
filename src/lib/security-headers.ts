export const SECURITY_HEADERS: Record<string, string> = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  // Report-Only during initial rollout — switch to Content-Security-Policy
  // once monitoring confirms no false positives.
  'Content-Security-Policy-Report-Only': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://*.convex.cloud",
    "font-src 'self'",
    "connect-src 'self' https://*.convex.cloud wss://*.convex.cloud https://challenges.cloudflare.com",
    'frame-src https://challenges.cloudflare.com',
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '),
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
