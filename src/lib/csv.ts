/**
 * RFC 4180–compliant CSV escape.
 * Wraps the value in double quotes if it contains a comma, double quote,
 * carriage return, or newline. Internal double quotes are doubled.
 */
export function csvEscape(value: string): string {
  return /[,"\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

/**
 * Join an array of field values into a single CSV row (no trailing newline).
 */
export function csvRow(fields: string[]): string {
  return fields.map(csvEscape).join(',')
}

/** UTF-8 BOM for broad spreadsheet compatibility. */
export const CSV_BOM = '\uFEFF'
