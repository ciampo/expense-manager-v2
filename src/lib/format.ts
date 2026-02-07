/**
 * Format cents to EUR display using English locale
 * @param cents - Amount in cents (e.g., 1250 = €12.50)
 */
export const formatCurrency = (cents: number): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR' }).format(
    cents / 100
  )

/**
 * Parse a YYYY-MM-DD string as a **local** date.
 * new Date('YYYY-MM-DD') is parsed as UTC midnight, which can shift
 * to the previous day in negative UTC offset timezones.
 */
function parseLocalDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/**
 * Format ISO date string for display using English locale (MM/DD/YYYY)
 * @param isoDate - ISO date string (YYYY-MM-DD)
 */
export const formatDate = (isoDate: string): string =>
  new Intl.DateTimeFormat('en-US').format(parseLocalDate(isoDate))

/**
 * Format date for display with day of week
 * @param isoDate - ISO date string (YYYY-MM-DD)
 */
export const formatDateLong = (isoDate: string): string =>
  new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(parseLocalDate(isoDate))

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
 * Get current date as ISO string (YYYY-MM-DD) using **local** time.
 * Using toISOString() would return UTC which can differ from local date
 * in negative UTC offset timezones.
 */
export const getTodayISO = (): string => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Get month name in English
 * @param month - Month number (1-12)
 * @param year - Year
 */
export const getMonthName = (month: number, year: number): string => {
  const date = new Date(year, month - 1, 1)
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date)
}
