import handler, { createServerEntry } from '@tanstack/react-start/server-entry'
import { handleCspReport } from '@/lib/csp-report'
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
