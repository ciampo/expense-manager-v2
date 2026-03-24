import { createMiddleware, createStart } from '@tanstack/react-start'
import { setResponseHeader } from '@tanstack/react-start/server'
import { buildCspHeader } from '@/lib/security-headers'

function generateNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes))
}

const cspMiddleware = createMiddleware().server(({ next, request }) => {
  if (request.method !== 'GET') {
    return next()
  }

  const nonce = generateNonce()

  setResponseHeader('Content-Security-Policy', buildCspHeader(nonce))

  return next({ context: { nonce } })
})

export const startInstance = createStart(() => ({
  requestMiddleware: [cspMiddleware],
}))
