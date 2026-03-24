import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { UnsavedChangesDialog } from '@/components/unsaved-changes-dialog'

describe('UnsavedChangesDialog', () => {
  it('renders the dialog when open is true', () => {
    render(<UnsavedChangesDialog open={true} onStay={vi.fn()} onLeave={vi.fn()} />)

    expect(screen.getByRole('alertdialog')).toBeDefined()
    expect(screen.getByText('Unsaved changes')).toBeDefined()
    expect(screen.getByText(/you have unsaved changes that will be lost/i)).toBeDefined()
  })

  it('does not render the dialog when open is false', () => {
    render(<UnsavedChangesDialog open={false} onStay={vi.fn()} onLeave={vi.fn()} />)

    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('calls onLeave when "Leave page" is clicked', () => {
    const onLeave = vi.fn()
    render(<UnsavedChangesDialog open={true} onStay={vi.fn()} onLeave={onLeave} />)

    fireEvent.click(screen.getByRole('button', { name: /leave page/i }))

    expect(onLeave).toHaveBeenCalledOnce()
  })

  it('calls onStay when "Stay on page" is clicked', () => {
    const onStay = vi.fn()
    render(<UnsavedChangesDialog open={true} onStay={onStay} onLeave={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /stay on page/i }))

    expect(onStay).toHaveBeenCalled()
  })

  it('renders both action buttons', () => {
    render(<UnsavedChangesDialog open={true} onStay={vi.fn()} onLeave={vi.fn()} />)

    expect(screen.getByRole('button', { name: /stay on page/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /leave page/i })).toBeDefined()
  })
})
