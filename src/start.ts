import crypto from 'node:crypto'
import { createMiddleware, createStart } from '@tanstack/react-start'
import { setResponseHeader } from '@tanstack/react-start/server'
import { buildCspHeader } from '@/lib/security-headers'

const cspMiddleware = createMiddleware().server(({ next, request }) => {
  if (request.method !== 'GET') {
    return next()
  }

  const nonce = crypto.randomBytes(16).toString('base64')

  setResponseHeader('Content-Security-Policy', buildCspHeader(nonce))

  return next({ context: { nonce } })
})

export const startInstance = createStart(() => ({
  requestMiddleware: [cspMiddleware],
}))
