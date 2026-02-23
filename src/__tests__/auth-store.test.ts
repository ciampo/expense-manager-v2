import { describe, it, expect, vi } from 'vitest'
import { createAuthStore } from '../lib/auth-store'

// ---------------------------------------------------------------------------
// Basic behavior
// ---------------------------------------------------------------------------

describe('createAuthStore', () => {
  it('starts in a loading state', () => {
    const store = createAuthStore()
    expect(store.isLoading).toBe(true)
    expect(store.isAuthenticated).toBe(false)
  })

  it('exposes an invalidateRouter slot initialized to null', () => {
    const store = createAuthStore()
    expect(store.invalidateRouter).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// waitForAuth — initial resolution
// ---------------------------------------------------------------------------

describe('waitForAuth — initial resolution', () => {
  it('resolves when isLoading transitions from true to false (authenticated)', async () => {
    const store = createAuthStore()

    store.update({ isAuthenticated: true, isLoading: false })

    const result = await store.waitForAuth()
    expect(result).toEqual({ isAuthenticated: true })
  })

  it('resolves when isLoading transitions from true to false (unauthenticated)', async () => {
    const store = createAuthStore()

    store.update({ isAuthenticated: false, isLoading: false })

    const result = await store.waitForAuth()
    expect(result).toEqual({ isAuthenticated: false })
  })

  it('waits until isLoading becomes false before resolving', async () => {
    const store = createAuthStore()
    let resolved = false

    const promise = store.waitForAuth().then((r) => {
      resolved = true
      return r
    })

    // Still loading — should not have resolved yet
    await Promise.resolve() // flush microtasks
    expect(resolved).toBe(false)

    // Now complete loading
    store.update({ isAuthenticated: true, isLoading: false })

    const result = await promise
    expect(resolved).toBe(true)
    expect(result).toEqual({ isAuthenticated: true })
  })

  it('returns a fresh resolved promise when called after loading is done', async () => {
    const store = createAuthStore()

    store.update({ isAuthenticated: true, isLoading: false })

    // First call resolves the internal promise
    await store.waitForAuth()

    // Second call — isLoading is false, so it returns Promise.resolve()
    // with the *current* isAuthenticated value
    store.update({ isAuthenticated: false, isLoading: false })
    const result = await store.waitForAuth()
    expect(result).toEqual({ isAuthenticated: false })
  })
})

// ---------------------------------------------------------------------------
// waitForAuth — loading restart (multi-shot)
// ---------------------------------------------------------------------------

describe('waitForAuth — loading restart (multi-shot)', () => {
  it('creates a new promise when loading restarts, resolving with updated state', async () => {
    const store = createAuthStore()

    // Phase 1: initial auth check → authenticated
    store.update({ isAuthenticated: true, isLoading: false })

    const firstResult = await store.waitForAuth()
    expect(firstResult).toEqual({ isAuthenticated: true })

    // Phase 2: loading restarts (e.g. token refresh)
    store.update({ isAuthenticated: store.isAuthenticated, isLoading: true })

    // Phase 3: re-auth completes — now unauthenticated
    store.update({ isAuthenticated: false, isLoading: false })

    const secondResult = await store.waitForAuth()
    expect(secondResult).toEqual({ isAuthenticated: false })
  })

  it('makes waitForAuth() wait during a restarted loading phase', async () => {
    const store = createAuthStore()

    // Complete initial auth
    store.update({ isAuthenticated: true, isLoading: false })
    await store.waitForAuth()

    // Restart loading
    store.update({ isAuthenticated: store.isAuthenticated, isLoading: true })

    let resolved = false
    const promise = store.waitForAuth().then((r) => {
      resolved = true
      return r
    })

    // Should not resolve while loading
    await Promise.resolve()
    expect(resolved).toBe(false)

    // Complete re-auth
    store.update({ isAuthenticated: false, isLoading: false })

    const result = await promise
    expect(resolved).toBe(true)
    expect(result).toEqual({ isAuthenticated: false })
  })

  it('handles multiple loading restarts correctly', async () => {
    const store = createAuthStore()

    // Cycle 1: authenticated
    store.update({ isAuthenticated: true, isLoading: false })
    expect(await store.waitForAuth()).toEqual({ isAuthenticated: true })

    // Cycle 2: token refresh → still authenticated
    store.update({ isAuthenticated: store.isAuthenticated, isLoading: true })
    store.update({ isAuthenticated: true, isLoading: false })
    expect(await store.waitForAuth()).toEqual({ isAuthenticated: true })

    // Cycle 3: session revoked → unauthenticated
    store.update({ isAuthenticated: store.isAuthenticated, isLoading: true })
    store.update({ isAuthenticated: false, isLoading: false })
    expect(await store.waitForAuth()).toEqual({ isAuthenticated: false })
  })
})

// ---------------------------------------------------------------------------
// Regression: single-shot promise would return stale data
// ---------------------------------------------------------------------------

describe('waitForAuth — regression: stale promise after loading restart', () => {
  it('does NOT return the stale initial value when loading restarts', async () => {
    const store = createAuthStore()

    // Initial auth: user is authenticated
    store.update({ isAuthenticated: true, isLoading: false })
    const initial = await store.waitForAuth()
    expect(initial).toEqual({ isAuthenticated: true })

    // Loading restarts (e.g. token refresh / re-auth)
    store.update({ isAuthenticated: store.isAuthenticated, isLoading: true })

    // Auth state changes during re-auth
    store.update({ isAuthenticated: false, isLoading: false })

    // With a single-shot (broken) implementation, waitForAuth() during
    // loading would return the old already-resolved promise with
    // { isAuthenticated: true }. The multi-shot implementation creates
    // a fresh promise, so we correctly get the new value.
    const afterRestart = await store.waitForAuth()
    expect(afterRestart).toEqual({ isAuthenticated: false })
  })

  it('a caller waiting during restarted loading gets the new value, not stale', async () => {
    const store = createAuthStore()

    // Complete initial auth
    store.update({ isAuthenticated: true, isLoading: false })
    await store.waitForAuth()

    // Restart loading
    store.update({ isAuthenticated: store.isAuthenticated, isLoading: true })

    // Start waiting — with single-shot, this would resolve immediately
    // with the stale { isAuthenticated: true } from the first resolution.
    const waitPromise = store.waitForAuth()

    // Auth resolves differently this time
    store.update({ isAuthenticated: false, isLoading: false })

    const result = await waitPromise
    // Multi-shot: correctly returns the new value
    expect(result).toEqual({ isAuthenticated: false })
  })
})

// ---------------------------------------------------------------------------
// Getter values after update()
// ---------------------------------------------------------------------------

describe('update — getter values', () => {
  it('getters reflect the values passed to update()', () => {
    const store = createAuthStore()
    expect(store.isAuthenticated).toBe(false)
    expect(store.isLoading).toBe(true)

    store.update({ isAuthenticated: true, isLoading: false })
    expect(store.isAuthenticated).toBe(true)
    expect(store.isLoading).toBe(false)

    store.update({ isAuthenticated: false, isLoading: true })
    expect(store.isAuthenticated).toBe(false)
    expect(store.isLoading).toBe(true)
  })

  it('idempotent update() does not change state', () => {
    const store = createAuthStore()

    store.update({ isAuthenticated: true, isLoading: false })
    store.update({ isAuthenticated: true, isLoading: false })

    expect(store.isAuthenticated).toBe(true)
    expect(store.isLoading).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// isAuthenticated changing mid-loading
// ---------------------------------------------------------------------------

describe('update — isAuthenticated changes mid-loading', () => {
  it('resolves with the final isAuthenticated value when it changes during loading', async () => {
    const store = createAuthStore()

    // Auth starts loading, initially looks authenticated
    store.update({ isAuthenticated: true, isLoading: true })

    // Mid-loading, auth state flips (e.g. token deemed invalid)
    store.update({ isAuthenticated: false, isLoading: true })

    // Loading completes
    store.update({ isAuthenticated: false, isLoading: false })

    const result = await store.waitForAuth()
    expect(result).toEqual({ isAuthenticated: false })
  })
})

// ---------------------------------------------------------------------------
// Concurrent waitForAuth() callers
// ---------------------------------------------------------------------------

describe('waitForAuth — concurrent callers', () => {
  it('multiple callers during the same loading phase all resolve with the same value', async () => {
    const store = createAuthStore()

    const p1 = store.waitForAuth()
    const p2 = store.waitForAuth()
    const p3 = store.waitForAuth()

    store.update({ isAuthenticated: true, isLoading: false })

    const [r1, r2, r3] = await Promise.all([p1, p2, p3])
    expect(r1).toEqual({ isAuthenticated: true })
    expect(r2).toEqual({ isAuthenticated: true })
    expect(r3).toEqual({ isAuthenticated: true })
  })

  it('callers during different loading phases get their respective results', async () => {
    const store = createAuthStore()

    // Phase 1: caller waits during initial load
    const phase1 = store.waitForAuth()
    store.update({ isAuthenticated: true, isLoading: false })
    expect(await phase1).toEqual({ isAuthenticated: true })

    // Phase 2: restart loading, new caller waits
    store.update({ isAuthenticated: store.isAuthenticated, isLoading: true })
    const phase2 = store.waitForAuth()
    store.update({ isAuthenticated: false, isLoading: false })
    expect(await phase2).toEqual({ isAuthenticated: false })
  })
})

// ---------------------------------------------------------------------------
// invalidateRouter callback
// ---------------------------------------------------------------------------

describe('invalidateRouter', () => {
  it('can be assigned and invoked after store creation', () => {
    const store = createAuthStore()
    const spy = vi.fn()

    store.invalidateRouter = spy
    store.invalidateRouter()

    expect(spy).toHaveBeenCalledOnce()
  })

  it('can be reassigned', () => {
    const store = createAuthStore()
    const first = vi.fn()
    const second = vi.fn()

    store.invalidateRouter = first
    store.invalidateRouter()
    expect(first).toHaveBeenCalledOnce()

    store.invalidateRouter = second
    store.invalidateRouter()
    expect(second).toHaveBeenCalledOnce()
    expect(first).toHaveBeenCalledOnce()
  })
})
