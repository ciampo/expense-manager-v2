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

  it('passes shouldBlockFn, enableBeforeUnload, withResolver, and disabled to useBlocker', () => {
    renderHook(() => useUnsavedChangesGuard(true))

    expect(useBlocker).toHaveBeenCalledWith(
      expect.objectContaining({
        shouldBlockFn: expect.any(Function),
        enableBeforeUnload: true,
        withResolver: true,
        disabled: false,
      }),
    )
  })

  it('disables the blocker when isDirty is false', () => {
    renderHook(() => useUnsavedChangesGuard(false))

    expect(vi.mocked(useBlocker)).toHaveBeenLastCalledWith(
      expect.objectContaining({ disabled: true }),
    )
  })

  it('enables the blocker when isDirty is true', () => {
    renderHook(() => useUnsavedChangesGuard(true))

    expect(vi.mocked(useBlocker)).toHaveBeenLastCalledWith(
      expect.objectContaining({ disabled: false }),
    )
  })

  it('toggles disabled when isDirty changes', () => {
    const { rerender } = renderHook(({ dirty }) => useUnsavedChangesGuard(dirty), {
      initialProps: { dirty: false },
    })

    expect(vi.mocked(useBlocker)).toHaveBeenLastCalledWith(
      expect.objectContaining({ disabled: true }),
    )

    rerender({ dirty: true })
    expect(vi.mocked(useBlocker)).toHaveBeenLastCalledWith(
      expect.objectContaining({ disabled: false }),
    )

    rerender({ dirty: false })
    expect(vi.mocked(useBlocker)).toHaveBeenLastCalledWith(
      expect.objectContaining({ disabled: true }),
    )
  })

  it('sets enableBeforeUnload based on isDirty state value', () => {
    const { rerender } = renderHook(({ dirty }) => useUnsavedChangesGuard(dirty), {
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
    const { result } = renderHook(() => useUnsavedChangesGuard(false))

    expect(result.current).toBe(mockBlocker)
  })
})
