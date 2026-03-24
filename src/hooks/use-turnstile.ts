import { useRef, useCallback, useState } from 'react'
import type { TurnstileInstance } from '@marsidev/react-turnstile'

export const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined

export function useTurnstile() {
  const ref = useRef<TurnstileInstance>(null)
  const [token, setToken] = useState<string | null>(null)

  const reset = useCallback(() => {
    setToken(null)
    ref.current?.reset()
  }, [])

  const clearToken = useCallback(() => setToken(null), [])

  return { ref, token, setToken, reset, clearToken }
}
