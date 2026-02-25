import { describe, it, expect } from 'vitest'
import { hasExactMatch, shouldShowCreateOption } from '@/lib/combobox'

describe('hasExactMatch', () => {
  it('returns true for an exact case-sensitive match', () => {
    expect(hasExactMatch(['Apple', 'Banana'], 'Apple')).toBe(true)
  })

  it('returns true for a case-insensitive match', () => {
    expect(hasExactMatch(['Apple', 'Banana'], 'apple')).toBe(true)
    expect(hasExactMatch(['Apple', 'Banana'], 'BANANA')).toBe(true)
  })

  it('returns false when no item matches', () => {
    expect(hasExactMatch(['Apple', 'Banana'], 'Cherry')).toBe(false)
  })

  it('returns false for partial matches', () => {
    expect(hasExactMatch(['Apple Pie', 'Banana'], 'Apple')).toBe(false)
  })

  it('returns false for an empty list', () => {
    expect(hasExactMatch([], 'anything')).toBe(false)
  })

  it('handles empty query against non-empty list', () => {
    expect(hasExactMatch(['Apple'], '')).toBe(false)
  })
})

describe('shouldShowCreateOption', () => {
  it('returns true when query does not match any item', () => {
    expect(shouldShowCreateOption(['Apple', 'Banana'], 'Cherry')).toBe(true)
  })

  it('returns false when query matches an item (case-insensitive)', () => {
    expect(shouldShowCreateOption(['Apple', 'Banana'], 'apple')).toBe(false)
  })

  it('returns false when query is empty', () => {
    expect(shouldShowCreateOption(['Apple', 'Banana'], '')).toBe(false)
  })

  it('returns false when query is only whitespace', () => {
    expect(shouldShowCreateOption(['Apple'], '   ')).toBe(false)
  })

  it('returns true for a non-matching query with leading/trailing spaces', () => {
    expect(shouldShowCreateOption(['Apple'], ' Cherry ')).toBe(true)
  })

  it('returns false for an empty list with an empty query', () => {
    expect(shouldShowCreateOption([], '')).toBe(false)
  })

  it('returns true for an empty list with a non-empty query', () => {
    expect(shouldShowCreateOption([], 'New Item')).toBe(true)
  })
})
