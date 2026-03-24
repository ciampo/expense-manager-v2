import handler, { createServerEntry } from '@tanstack/react-start/server-entry'
import { addSecurityHeaders, CSP_REPORT_PATH } from '@/lib/security-headers'

export default createServerEntry({
  async fetch(request) {
    const url = new URL(request.url)

    if (url.pathname === CSP_REPORT_PATH && request.method === 'POST') {
      return addSecurityHeaders(await handleCspReport(request))
    }

    const response = await handler.fetch(request)
    return addSecurityHeaders(response)
  },
})

async function handleCspReport(request: Request): Promise<Response> {
  try {
    const body = await request.json()
    console.log('[CSP Report]', JSON.stringify(body))
  } catch {
    console.warn('[CSP Report] Failed to parse report body')
  }
  return new Response(null, { status: 204 })
}
