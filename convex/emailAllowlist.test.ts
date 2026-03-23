import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { isEmailAllowed, parseAllowedEmails } from './emailAllowlist'

describe('parseAllowedEmails', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('returns empty array when ALLOWED_EMAILS is unset', () => {
    delete process.env.ALLOWED_EMAILS
    expect(parseAllowedEmails()).toEqual([])
  })

  it('returns empty array when ALLOWED_EMAILS is empty string', () => {
    process.env.ALLOWED_EMAILS = ''
    expect(parseAllowedEmails()).toEqual([])
  })

  it('parses a single email', () => {
    process.env.ALLOWED_EMAILS = 'alice@example.com'
    expect(parseAllowedEmails()).toEqual(['alice@example.com'])
  })

  it('parses multiple comma-separated emails', () => {
    process.env.ALLOWED_EMAILS = 'alice@example.com,bob@example.com,*@mycompany.org'
    expect(parseAllowedEmails()).toEqual([
      'alice@example.com',
      'bob@example.com',
      '*@mycompany.org',
    ])
  })

  it('trims whitespace around entries', () => {
    process.env.ALLOWED_EMAILS = '  alice@example.com , bob@example.com  '
    expect(parseAllowedEmails()).toEqual(['alice@example.com', 'bob@example.com'])
  })

  it('lowercases all entries', () => {
    process.env.ALLOWED_EMAILS = 'Alice@Example.COM,*@MyCompany.ORG'
    expect(parseAllowedEmails()).toEqual(['alice@example.com', '*@mycompany.org'])
  })

  it('filters out empty entries from trailing commas', () => {
    process.env.ALLOWED_EMAILS = 'alice@example.com,,bob@example.com,'
    expect(parseAllowedEmails()).toEqual(['alice@example.com', 'bob@example.com'])
  })
})

describe('isEmailAllowed', () => {
  it('allows any email when allowlist is empty', () => {
    expect(isEmailAllowed('anyone@example.com', [])).toBe(true)
  })

  it('allows undefined email when allowlist is empty', () => {
    expect(isEmailAllowed(undefined, [])).toBe(true)
  })

  it('rejects undefined email when allowlist is non-empty', () => {
    expect(isEmailAllowed(undefined, ['alice@example.com'])).toBe(false)
  })

  it('matches exact email addresses', () => {
    const allowed = ['alice@example.com', 'bob@example.com']
    expect(isEmailAllowed('alice@example.com', allowed)).toBe(true)
    expect(isEmailAllowed('bob@example.com', allowed)).toBe(true)
    expect(isEmailAllowed('eve@example.com', allowed)).toBe(false)
  })

  it('matches case-insensitively', () => {
    const allowed = ['alice@example.com']
    expect(isEmailAllowed('Alice@Example.COM', allowed)).toBe(true)
    expect(isEmailAllowed('ALICE@EXAMPLE.COM', allowed)).toBe(true)
  })

  it('matches domain wildcards', () => {
    const allowed = ['*@mycompany.org']
    expect(isEmailAllowed('alice@mycompany.org', allowed)).toBe(true)
    expect(isEmailAllowed('bob@mycompany.org', allowed)).toBe(true)
    expect(isEmailAllowed('alice@other.com', allowed)).toBe(false)
  })

  it('matches domain wildcards case-insensitively', () => {
    const allowed = ['*@mycompany.org']
    expect(isEmailAllowed('Alice@MyCompany.ORG', allowed)).toBe(true)
  })

  it('does not match partial domain names', () => {
    const allowed = ['*@company.org']
    expect(isEmailAllowed('alice@notcompany.org', allowed)).toBe(false)
  })

  it('handles mixed exact and wildcard entries', () => {
    const allowed = ['alice@personal.com', '*@work.org']
    expect(isEmailAllowed('alice@personal.com', allowed)).toBe(true)
    expect(isEmailAllowed('bob@work.org', allowed)).toBe(true)
    expect(isEmailAllowed('bob@personal.com', allowed)).toBe(false)
    expect(isEmailAllowed('alice@other.com', allowed)).toBe(false)
  })

  it('rejects empty string email when allowlist is non-empty', () => {
    expect(isEmailAllowed('', ['alice@example.com'])).toBe(false)
  })
})
