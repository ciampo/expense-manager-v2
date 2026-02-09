import { describe, it, expect } from 'vitest'
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

    store.isAuthenticated = true
    store.isLoading = false

    const result = await store.waitForAuth()
    expect(result).toEqual({ isAuthenticated: true })
  })

  it('resolves when isLoading transitions from true to false (unauthenticated)', async () => {
    const store = createAuthStore()

    store.isAuthenticated = false
    store.isLoading = false

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
    store.isAuthenticated = true
    store.isLoading = false

    const result = await promise
    expect(resolved).toBe(true)
    expect(result).toEqual({ isAuthenticated: true })
  })

  it('returns a fresh resolved promise when called after loading is done', async () => {
    const store = createAuthStore()

    store.isAuthenticated = true
    store.isLoading = false

    // First call resolves the internal promise
    await store.waitForAuth()

    // Second call — isLoading is false, so it returns Promise.resolve()
    // with the *current* isAuthenticated value
    store.isAuthenticated = false
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
    store.isAuthenticated = true
    store.isLoading = false

    const firstResult = await store.waitForAuth()
    expect(firstResult).toEqual({ isAuthenticated: true })

    // Phase 2: loading restarts (e.g. token refresh)
    store.isLoading = true

    // Phase 3: re-auth completes — now unauthenticated
    store.isAuthenticated = false
    store.isLoading = false

    const secondResult = await store.waitForAuth()
    expect(secondResult).toEqual({ isAuthenticated: false })
  })

  it('makes waitForAuth() wait during a restarted loading phase', async () => {
    const store = createAuthStore()

    // Complete initial auth
    store.isAuthenticated = true
    store.isLoading = false
    await store.waitForAuth()

    // Restart loading
    store.isLoading = true

    let resolved = false
    const promise = store.waitForAuth().then((r) => {
      resolved = true
      return r
    })

    // Should not resolve while loading
    await Promise.resolve()
    expect(resolved).toBe(false)

    // Complete re-auth
    store.isAuthenticated = false
    store.isLoading = false

    const result = await promise
    expect(resolved).toBe(true)
    expect(result).toEqual({ isAuthenticated: false })
  })

  it('handles multiple loading restarts correctly', async () => {
    const store = createAuthStore()

    // Cycle 1: authenticated
    store.isAuthenticated = true
    store.isLoading = false
    expect(await store.waitForAuth()).toEqual({ isAuthenticated: true })

    // Cycle 2: token refresh → still authenticated
    store.isLoading = true
    store.isAuthenticated = true
    store.isLoading = false
    expect(await store.waitForAuth()).toEqual({ isAuthenticated: true })

    // Cycle 3: session revoked → unauthenticated
    store.isLoading = true
    store.isAuthenticated = false
    store.isLoading = false
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
    store.isAuthenticated = true
    store.isLoading = false
    const initial = await store.waitForAuth()
    expect(initial).toEqual({ isAuthenticated: true })

    // Loading restarts (e.g. token refresh / re-auth)
    store.isLoading = true

    // Auth state changes during re-auth
    store.isAuthenticated = false
    store.isLoading = false

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
    store.isAuthenticated = true
    store.isLoading = false
    await store.waitForAuth()

    // Restart loading
    store.isLoading = true

    // Start waiting — with single-shot, this would resolve immediately
    // with the stale { isAuthenticated: true } from the first resolution.
    const waitPromise = store.waitForAuth()

    // Auth resolves differently this time
    store.isAuthenticated = false
    store.isLoading = false

    const result = await waitPromise
    // Multi-shot: correctly returns the new value
    expect(result).toEqual({ isAuthenticated: false })
  })
})
