import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FieldError } from '@/components/ui/field'

describe('FieldError', () => {
  it('renders nothing when errors is undefined', () => {
    const { container } = render(<FieldError />)
    expect(container.innerHTML).toBe('')
  })

  it('renders nothing when errors is an empty array', () => {
    const { container } = render(<FieldError errors={[]} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders nothing when errors contains only undefined entries', () => {
    const { container } = render(<FieldError errors={[undefined, undefined]} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders a single error as plain text with role="alert"', () => {
    render(<FieldError errors={[{ message: 'Email is required.' }]} />)

    const alert = screen.getByRole('alert')
    expect(alert.textContent).toBe('Email is required.')
    expect(alert.querySelector('ul')).toBeNull()
  })

  it('renders multiple unique errors as a list', () => {
    render(
      <FieldError
        errors={[
          { message: 'Too short.' },
          { message: 'Must contain a number.' },
        ]}
      />,
    )

    const alert = screen.getByRole('alert')
    const items = alert.querySelectorAll('li')
    expect(items.length).toBe(2)
    expect(items[0].textContent).toBe('Too short.')
    expect(items[1].textContent).toBe('Must contain a number.')
  })

  it('deduplicates errors with identical messages', () => {
    render(
      <FieldError
        errors={[
          { message: 'Required.' },
          { message: 'Required.' },
          { message: 'Required.' },
        ]}
      />,
    )

    const alert = screen.getByRole('alert')
    expect(alert.textContent).toBe('Required.')
    expect(alert.querySelector('ul')).toBeNull()
  })

  it('prefers children over errors prop', () => {
    render(
      <FieldError errors={[{ message: 'Ignored.' }]}>
        <span>Custom content</span>
      </FieldError>,
    )

    const alert = screen.getByRole('alert')
    expect(alert.textContent).toBe('Custom content')
    expect(alert.textContent).not.toContain('Ignored.')
  })

  it('applies data-slot="field-error" for styling hooks', () => {
    render(<FieldError errors={[{ message: 'Error' }]} />)

    const alert = screen.getByRole('alert')
    expect(alert.getAttribute('data-slot')).toBe('field-error')
  })

  it('passes through id and className', () => {
    render(
      <FieldError
        id="email-error"
        className="text-center"
        errors={[{ message: 'Bad' }]}
      />,
    )

    const alert = screen.getByRole('alert')
    expect(alert.id).toBe('email-error')
    expect(alert.className).toContain('text-center')
  })

  it('filters out errors with undefined messages in a list', () => {
    render(
      <FieldError
        errors={[
          { message: 'Visible error.' },
          { message: undefined },
          { message: 'Another error.' },
        ]}
      />,
    )

    const alert = screen.getByRole('alert')
    const items = alert.querySelectorAll('li')
    expect(items.length).toBe(2)
    expect(items[0].textContent).toBe('Visible error.')
    expect(items[1].textContent).toBe('Another error.')
  })
})
