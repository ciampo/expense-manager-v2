/**
 * Cache module-level Intl formatters for performance.
 * Intl formatter construction is relatively expensive (parses locale data, resolves options).
 */
const eurFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'EUR',
})

const dateFormatter = new Intl.DateTimeFormat('en-US')

const dateLongFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
})

const monthNameFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
})

/**
 * Format cents to EUR display using English locale
 * @param cents - Amount in cents (e.g., 1250 = €12.50)
 */
export const formatCurrency = (cents: number): string =>
  eurFormatter.format(cents / 100)

/**
 * Parse a YYYY-MM-DD string as a **local** date.
 * new Date('YYYY-MM-DD') is parsed as UTC midnight, which can produce a
 * different calendar date than the user's local date in non-UTC timezones.
 *
 * Validates both the format and that the components form a real calendar
 * date (e.g. rejects 2024-02-30 instead of silently normalizing to March 1).
 */
export function parseLocalDate(isoDate: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate)
  if (!match) {
    return new Date(NaN)
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])

  const date = new Date(year, month - 1, day)

  // Verify that Date didn't normalize an invalid date (e.g. 2024-02-30 → 2024-03-01)
  if (date.getFullYear() !== year || date.getMonth() + 1 !== month || date.getDate() !== day) {
    return new Date(NaN)
  }

  return date
}

/**
 * Format ISO date string for display using English locale (MM/DD/YYYY)
 * @param isoDate - ISO date string (YYYY-MM-DD)
 */
export const formatDate = (isoDate: string): string =>
  dateFormatter.format(parseLocalDate(isoDate))

/**
 * Format date for display with day of week
 * @param isoDate - ISO date string (YYYY-MM-DD)
 */
export const formatDateLong = (isoDate: string): string =>
  dateLongFormatter.format(parseLocalDate(isoDate))

/**
 * Parse EUR input to cents
 * @param value - String value like "12.50" or "12,50"
 * @returns Number of cents
 */
export const parseCurrencyToCents = (value: string): number => {
  // Replace comma with dot for parsing
  const normalized = value.replace(',', '.')
  const parsed = parseFloat(normalized)
  if (isNaN(parsed)) return 0
  return Math.round(parsed * 100)
}

/**
 * Format cents to input value (for form inputs)
 * @param cents - Amount in cents
 * @returns String like "12.50"
 */
export const centsToInputValue = (cents: number): string => {
  return (cents / 100).toFixed(2)
}

/**
 * Format a Date object to a YYYY-MM-DD string using **local** date components.
 * Avoids toISOString(), which returns UTC and can produce a different calendar
 * date than the user's local date in non-UTC timezones.
 */
export function toISODateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Get current date as ISO string (YYYY-MM-DD) using **local** time.
 */
export const getTodayISO = (): string => toISODateString(new Date())

/**
 * Get month name in English
 * @param month - Month number (1-12)
 * @param year - Year
 */
export const getMonthName = (month: number, year: number): string => {
  const date = new Date(year, month - 1, 1)
  return monthNameFormatter.format(date)
}
