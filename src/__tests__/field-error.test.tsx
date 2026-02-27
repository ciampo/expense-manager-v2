import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { FieldError } from '@/components/ui/field'

describe('FieldError', () => {
  it('renders nothing when errors is undefined', () => {
    render(<FieldError />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('renders nothing when errors is an empty array', () => {
    render(<FieldError errors={[]} />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('renders nothing when errors contains only undefined entries', () => {
    render(<FieldError errors={[undefined, undefined]} />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('renders a single error as plain text with role="alert"', () => {
    render(<FieldError errors={[{ message: 'Email is required.' }]} />)

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Email is required.')
    expect(within(alert).queryByRole('list')).not.toBeInTheDocument()
  })

  it('renders multiple unique errors as a list', () => {
    render(
      <FieldError errors={[{ message: 'Too short.' }, { message: 'Must contain a number.' }]} />,
    )

    const alert = screen.getByRole('alert')
    const items = within(alert).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('Too short.')
    expect(items[1]).toHaveTextContent('Must contain a number.')
  })

  it('deduplicates errors with identical messages', () => {
    render(
      <FieldError
        errors={[{ message: 'Required.' }, { message: 'Required.' }, { message: 'Required.' }]}
      />,
    )

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Required.')
    expect(within(alert).queryByRole('list')).not.toBeInTheDocument()
  })

  it('prefers children over errors prop', () => {
    render(
      <FieldError errors={[{ message: 'Ignored.' }]}>
        <span>Custom content</span>
      </FieldError>,
    )

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Custom content')
    expect(alert).not.toHaveTextContent('Ignored.')
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
    const items = within(alert).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('Visible error.')
    expect(items[1]).toHaveTextContent('Another error.')
  })
})
