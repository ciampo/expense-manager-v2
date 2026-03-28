/** Content types that legitimate CSP violation reports use. */
const ALLOWED_CONTENT_TYPES = new Set([
  'application/csp-report', // report-uri (legacy)
  'application/reports+json', // Reporting API v1
])

/** Maximum request body size in bytes (10 KB). */
export const CSP_REPORT_MAX_BODY_BYTES = 10_240

/** Maximum CSP report requests per IP within the rate-limit window. */
export const CSP_REPORT_RATE_LIMIT_MAX = 10

/** Rate-limit window duration in milliseconds (60 s). */
export const CSP_REPORT_RATE_LIMIT_WINDOW_MS = 60_000

/**
 * Maximum tracked IPs before stale-entry eviction runs.
 * When all entries are fresh and the cap is reached, new IPs are
 * load-shed (treated as rate-limited) to prevent unbounded map growth.
 */
export const CSP_REPORT_RATE_LIMIT_MAP_CAP = 1_000

interface RateLimitEntry {
  count: number
  windowStart: number
}

const ipBuckets = new Map<string, RateLimitEntry>()

/** Clear all tracked IPs — exposed for tests only. */
export function resetCspRateLimiter(): void {
  ipBuckets.clear()
}

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = ipBuckets.get(ip)

  if (!entry || now - entry.windowStart >= CSP_REPORT_RATE_LIMIT_WINDOW_MS) {
    if (ipBuckets.size >= CSP_REPORT_RATE_LIMIT_MAP_CAP) {
      for (const [key, val] of ipBuckets) {
        if (now - val.windowStart >= CSP_REPORT_RATE_LIMIT_WINDOW_MS) {
          ipBuckets.delete(key)
        }
      }
      if (ipBuckets.size >= CSP_REPORT_RATE_LIMIT_MAP_CAP) {
        return true
      }
    }
    ipBuckets.set(ip, { count: 1, windowStart: now })
    return false
  }

  entry.count += 1
  return entry.count > CSP_REPORT_RATE_LIMIT_MAX
}

/**
 * Read the request body up to `maxBytes`. Returns `null` when the body
 * exceeds the limit (the stream is cancelled).
 */
async function readLimitedBody(request: Request, maxBytes: number): Promise<string | null> {
  const reader = request.body?.getReader()
  if (!reader) return ''

  const chunks: Uint8Array[] = []
  let totalBytes = 0

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break

    totalBytes += value.byteLength
    if (totalBytes > maxBytes) {
      await reader.cancel()
      return null
    }
    chunks.push(value)
  }

  const combined = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    combined.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(combined)
}

/**
 * Handle an incoming CSP violation report with hardened validation:
 *
 * 1. Per-IP rate limiting (fixed window, 10 req / 60 s per isolate)
 * 2. Content-Type must be `application/csp-report` or `application/reports+json`
 * 3. Body capped at 10 KB (fast-path via Content-Length, then streaming check)
 */
export async function handleCspReport(request: Request): Promise<Response> {
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown'
  if (isRateLimited(ip)) {
    return new Response(null, {
      status: 429,
      headers: { 'Retry-After': String(Math.ceil(CSP_REPORT_RATE_LIMIT_WINDOW_MS / 1000)) },
    })
  }

  const rawType = request.headers.get('Content-Type') ?? ''
  const mediaType = rawType.split(';')[0].trim().toLowerCase()
  if (!ALLOWED_CONTENT_TYPES.has(mediaType)) {
    return new Response(null, { status: 415 })
  }

  const declaredLength = Number(request.headers.get('Content-Length'))
  if (declaredLength > CSP_REPORT_MAX_BODY_BYTES) {
    return new Response(null, { status: 413 })
  }

  try {
    const text = await readLimitedBody(request, CSP_REPORT_MAX_BODY_BYTES)
    if (text === null) {
      return new Response(null, { status: 413 })
    }
    const body: unknown = JSON.parse(text)
    console.log('[CSP Report]', JSON.stringify(body))
  } catch {
    console.warn('[CSP Report] Failed to parse report body')
  }

  return new Response(null, { status: 204 })
}
