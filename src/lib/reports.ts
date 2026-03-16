import { CSV_BOM, CSV_EOL, csvRow } from '@/lib/csv'
import { centsToInputValue, getItalianMonthName } from '@/lib/format'
import { extensionFromContentType } from '@/lib/download-utils'

/**
 * Build the full CSV string (with BOM) for a monthly expense report.
 *
 * Groups expenses by day-of-month and category, sums amounts, then
 * produces rows sorted by day then category with fixed Italian column
 * headers.
 */
export function buildCsvContent(
  expenses: Array<{ date: string; categoryName: string; amount: number }>,
  month: number,
): string {
  const italianMonth = getItalianMonthName(month)

  const grouped: Record<string, Record<string, number>> = {}

  for (const expense of expenses) {
    const day = String(parseInt(expense.date.split('-')[2], 10))
    if (!grouped[day]) {
      grouped[day] = {}
    }
    if (!grouped[day][expense.categoryName]) {
      grouped[day][expense.categoryName] = 0
    }
    grouped[day][expense.categoryName] += expense.amount
  }

  let csv = csvRow([italianMonth]) + CSV_EOL
  csv +=
    csvRow([
      'giorno',
      'descrizione',
      'aliquota',
      'imponibile',
      'imposta',
      'imponibile',
      'imposta',
      'totale spese documentate',
    ]) + CSV_EOL

  const days = Object.keys(grouped)
    .map(Number)
    .sort((a, b) => a - b)

  for (const day of days) {
    const categories = Object.keys(grouped[String(day)]).sort()
    for (const category of categories) {
      const amount = grouped[String(day)][category]
      csv +=
        csvRow([String(day), category, '', '', '', '', '', centsToInputValue(amount)]) + CSV_EOL
    }
  }

  return CSV_BOM + csv
}

/**
 * Build a deduplicated filename for a ZIP attachment entry.
 *
 * Sanitizes the merchant name, looks up the extension from the content
 * type, and appends a `-N` suffix when the same base filename has been
 * seen before. Mutates `filenameCount` to track occurrences.
 */
export function buildZipFilename(
  date: string,
  merchant: string,
  contentType: string,
  filenameCount: Record<string, number>,
): string {
  const extension = extensionFromContentType(contentType)
  const baseFilename = `${date}-${merchant.replace(/[^a-zA-Z0-9]+/g, '_')}`

  const countKey = baseFilename + extension
  const count = filenameCount[countKey] || 0
  filenameCount[countKey] = count + 1

  return count > 0 ? `${baseFilename}-${count}${extension}` : `${baseFilename}${extension}`
}
