/**
 * RFC 4180–compliant CSV escape with formula-injection mitigation.
 * Wraps the value in double quotes if it contains a comma, double quote,
 * carriage return, or newline. Internal double quotes are doubled.
 * Values starting with =, +, -, or @ are prefixed with an apostrophe
 * to prevent spreadsheet formula evaluation.
 */
export function csvEscape(value: string): string {
  let safe = value
  if (/^[=+\-@]/.test(safe)) {
    safe = `'${safe}`
  }
  return /[,"\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/**
 * Join an array of field values into a single CSV row (no trailing newline).
 */
export function csvRow(fields: string[]): string {
  return fields.map(csvEscape).join(',')
}

/** UTF-8 BOM for broad spreadsheet compatibility. */
export const CSV_BOM = '\uFEFF'

/** RFC 4180 line terminator. */
export const CSV_EOL = '\r\n'
