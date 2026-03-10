import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RouteErrorComponent } from '@/components/route-error'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...rest }: { to: string; children?: React.ReactNode }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}))

describe('RouteErrorComponent', () => {
  it('renders the error message', () => {
    render(<RouteErrorComponent error={new Error('Test failure')} reset={() => {}} />)

    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading.textContent).toBe('Something went wrong')
    expect(screen.getByText('Test failure')).toBeTruthy()
  })

  it('renders fallback message when error has no message', () => {
    render(<RouteErrorComponent error={new Error()} reset={() => {}} />)

    expect(screen.getByText('An unexpected error occurred.')).toBeTruthy()
  })

  it('calls reset when "Try again" is clicked', () => {
    const reset = vi.fn()
    render(<RouteErrorComponent error={new Error('fail')} reset={reset} />)

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(reset).toHaveBeenCalledOnce()
  })

  it('links back to the dashboard', () => {
    render(<RouteErrorComponent error={new Error('fail')} reset={() => {}} />)

    const link = screen.getByRole('link', { name: 'Back to dashboard' })
    expect(link.getAttribute('href')).toBe('/dashboard')
  })
})
