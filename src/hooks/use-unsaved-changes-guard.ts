import { useBlocker } from '@tanstack/react-router'
import { useCallback } from 'react'

/**
 * Blocks in-app navigation and the browser's beforeunload event when
 * `isDirty` is true.  Returns a resolver-style blocker (status, proceed,
 * reset).
 *
 * The blocker is disabled when `isDirty` is false.  To bypass the guard
 * for intentional programmatic navigations (e.g. after a successful save),
 * set `isDirty` to false via state before navigating — the blocker will
 * be disabled on the next render and the navigation can proceed unblocked.
 */
export function useUnsavedChangesGuard(isDirty: boolean) {
  const shouldBlockFn = useCallback(() => true, [])

  return useBlocker({
    shouldBlockFn,
    enableBeforeUnload: isDirty,
    withResolver: true,
    disabled: !isDirty,
  })
}
