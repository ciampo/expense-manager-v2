import handler, { createServerEntry } from '@tanstack/react-start/server-entry'
import { addSecurityHeaders } from './lib/security-headers'

export default createServerEntry({
  async fetch(request) {
    const response = await handler.fetch(request)
    return addSecurityHeaders(response)
  },
})
