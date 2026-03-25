import type { RefObject } from 'react'
import { useBlocker } from '@tanstack/react-router'
import { useRef, useEffect, useCallback } from 'react'

/**
 * Blocks in-app navigation and the browser's beforeunload event when
 * `isDirty` is true.  Returns a resolver-style blocker (status, proceed,
 * reset).
 *
 * `skipRef` lets the caller bypass the guard for intentional programmatic
 * navigations (e.g. after a successful save): set `skipRef.current = true`
 * right before calling `navigate()`.  The ref is auto-reset after one use.
 */
export function useUnsavedChangesGuard(isDirty: boolean, skipRef: RefObject<boolean>) {
  const isDirtyRef = useRef(isDirty)

  useEffect(() => {
    isDirtyRef.current = isDirty
  })

  // Stable reference: reads from refs so it never needs to change.
  const shouldBlockFn = useCallback(() => {
    if (skipRef.current) {
      skipRef.current = false
      return false
    }
    return isDirtyRef.current
  }, [skipRef])

  return useBlocker({
    shouldBlockFn,
    enableBeforeUnload: isDirty,
    withResolver: true,
  })
}
