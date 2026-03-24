import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

const mockBlocker = {
  status: 'idle' as const,
  proceed: vi.fn(),
  reset: vi.fn(),
}

vi.mock('@tanstack/react-router', () => ({
  useBlocker: vi.fn(() => mockBlocker),
}))

import { useBlocker } from '@tanstack/react-router'
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard'

describe('useUnsavedChangesGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function capturedShouldBlockFn() {
    const calls = vi.mocked(useBlocker).mock.calls
    return calls[calls.length - 1][0].shouldBlockFn!
  }

  it('passes shouldBlockFn, enableBeforeUnload, and withResolver to useBlocker', () => {
    const skipRef = { current: false }
    renderHook(() => useUnsavedChangesGuard(true, skipRef))

    expect(useBlocker).toHaveBeenCalledWith(
      expect.objectContaining({
        shouldBlockFn: expect.any(Function),
        enableBeforeUnload: true,
        withResolver: true,
      }),
    )
  })

  it('shouldBlockFn returns false when isDirty is false', () => {
    const skipRef = { current: false }
    renderHook(() => useUnsavedChangesGuard(false, skipRef))

    expect(capturedShouldBlockFn()()).toBe(false)
  })

  it('shouldBlockFn returns true when isDirty is true', () => {
    const skipRef = { current: false }
    renderHook(() => useUnsavedChangesGuard(true, skipRef))

    expect(capturedShouldBlockFn()()).toBe(true)
  })

  it('shouldBlockFn returns false and resets skipRef when skipRef is true', () => {
    const skipRef = { current: true }
    renderHook(() => useUnsavedChangesGuard(true, skipRef))

    expect(capturedShouldBlockFn()()).toBe(false)
    expect(skipRef.current).toBe(false)
  })

  it('shouldBlockFn reflects updated isDirty after re-render', () => {
    const skipRef = { current: false }
    const { rerender } = renderHook(({ dirty }) => useUnsavedChangesGuard(dirty, skipRef), {
      initialProps: { dirty: false },
    })

    expect(capturedShouldBlockFn()()).toBe(false)

    rerender({ dirty: true })
    expect(capturedShouldBlockFn()()).toBe(true)

    rerender({ dirty: false })
    expect(capturedShouldBlockFn()()).toBe(false)
  })

  it('sets enableBeforeUnload based on isDirty state value', () => {
    const skipRef = { current: false }
    const { rerender } = renderHook(({ dirty }) => useUnsavedChangesGuard(dirty, skipRef), {
      initialProps: { dirty: false },
    })

    expect(vi.mocked(useBlocker)).toHaveBeenLastCalledWith(
      expect.objectContaining({ enableBeforeUnload: false }),
    )

    rerender({ dirty: true })
    expect(vi.mocked(useBlocker)).toHaveBeenLastCalledWith(
      expect.objectContaining({ enableBeforeUnload: true }),
    )
  })

  it('returns the blocker object from useBlocker', () => {
    const skipRef = { current: false }
    const { result } = renderHook(() => useUnsavedChangesGuard(false, skipRef))

    expect(result.current).toBe(mockBlocker)
  })
})
