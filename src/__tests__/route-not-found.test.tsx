import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RouteNotFoundComponent } from '@/components/route-not-found'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...rest }: { to: string; children?: React.ReactNode }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}))

describe('RouteNotFoundComponent', () => {
  it('renders 404 heading', () => {
    render(<RouteNotFoundComponent />)

    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading.textContent).toBe('404')
  })

  it('renders descriptive message', () => {
    render(<RouteNotFoundComponent />)

    expect(
      screen.getByText("The page you're looking for doesn't exist or has been moved."),
    ).toBeTruthy()
  })

  it('links back to the dashboard', () => {
    render(<RouteNotFoundComponent />)

    const link = screen.getByRole('link', { name: 'Back to dashboard' })
    expect(link.getAttribute('href')).toBe('/dashboard')
  })
})
