import { describe, it, expect } from 'vitest'
import { buildCsvContent, buildZipFilename } from '@/lib/reports'
import { CSV_BOM, CSV_EOL } from '@/lib/csv'

function csvLines(result: string): string[] {
  expect(result.startsWith(CSV_BOM)).toBe(true)
  return result.slice(CSV_BOM.length).split(CSV_EOL)
}

describe('buildCsvContent', () => {
  const headerRow = `giorno,descrizione,aliquota,imponibile,imposta,imponibile,imposta,totale spese documentate`

  it('returns BOM-prefixed CSV with Italian month header', () => {
    const lines = csvLines(buildCsvContent([], 1))
    expect(lines[0]).toBe('Gennaio')
  })

  it('groups expenses by day and category, sums amounts within same group', () => {
    const expenses = [
      { date: '2026-01-05', categoryName: 'Food', amount: 1000 },
      { date: '2026-01-05', categoryName: 'Food', amount: 2500 },
    ]
    const lines = csvLines(buildCsvContent(expenses, 1))
    expect(lines[0]).toBe('Gennaio')
    expect(lines[1]).toBe(headerRow)
    expect(lines[2]).toBe('5,Food,,,,,,35.00')
    expect(lines).toHaveLength(4)
  })

  it('sorts rows by day ascending, then category alphabetically', () => {
    const expenses = [
      { date: '2026-03-15', categoryName: 'Transport', amount: 500 },
      { date: '2026-03-03', categoryName: 'Drinks', amount: 300 },
      { date: '2026-03-03', categoryName: 'Accommodation', amount: 700 },
      { date: '2026-03-15', categoryName: 'Food', amount: 1200 },
    ]
    const lines = csvLines(buildCsvContent(expenses, 3))
    expect(lines[0]).toBe('Marzo')
    expect(lines[1]).toBe(headerRow)
    expect(lines[2]).toBe('3,Accommodation,,,,,,7.00')
    expect(lines[3]).toBe('3,Drinks,,,,,,3.00')
    expect(lines[4]).toBe('15,Food,,,,,,12.00')
    expect(lines[5]).toBe('15,Transport,,,,,,5.00')
    expect(lines).toHaveLength(7)
  })

  it('returns only header rows when expenses array is empty', () => {
    const lines = csvLines(buildCsvContent([], 7))
    expect(lines[0]).toBe('Luglio')
    expect(lines[1]).toBe(headerRow)
    expect(lines[2]).toBe('')
    expect(lines).toHaveLength(3)
  })

  it('handles a single expense', () => {
    const lines = csvLines(
      buildCsvContent([{ date: '2026-12-25', categoryName: 'Gifts', amount: 5000 }], 12),
    )
    expect(lines[0]).toBe('Dicembre')
    expect(lines[1]).toBe(headerRow)
    expect(lines[2]).toBe('25,Gifts,,,,,,50.00')
    expect(lines).toHaveLength(4)
  })

  it('handles expenses with special characters in category name', () => {
    const lines = csvLines(
      buildCsvContent(
        [{ date: '2026-02-10', categoryName: 'Food, Drinks & More', amount: 1500 }],
        2,
      ),
    )
    expect(lines[0]).toBe('Febbraio')
    expect(lines[1]).toBe(headerRow)
    expect(lines[2]).toBe('10,"Food, Drinks & More",,,,,,15.00')
    expect(lines).toHaveLength(4)
  })

  it('prefixes formula-triggering category names with apostrophe', () => {
    const lines = csvLines(
      buildCsvContent([{ date: '2026-04-01', categoryName: '-Discount', amount: 800 }], 4),
    )
    expect(lines[0]).toBe('Aprile')
    expect(lines[1]).toBe(headerRow)
    expect(lines[2]).toBe("1,'-Discount,,,,,,8.00")
    expect(lines).toHaveLength(4)
  })
})

describe('buildZipFilename', () => {
  it('returns date-merchant.ext for first occurrence', () => {
    const counts: Record<string, number> = {}
    const result = buildZipFilename('2026-01-15', 'Supermarket', 'image/jpeg', counts)
    expect(result).toBe('2026-01-15-Supermarket.jpg')
  })

  it('sanitizes merchant name replacing non-alphanumeric chars with underscore', () => {
    const counts: Record<string, number> = {}
    const result = buildZipFilename('2026-03-01', 'Café & Bar #1', 'application/pdf', counts)
    expect(result).toBe('2026-03-01-Caf_Bar_1.pdf')
  })

  it('appends -1, -2 etc. for duplicate base filenames', () => {
    const counts: Record<string, number> = {}
    const first = buildZipFilename('2026-01-15', 'Shop', 'image/jpeg', counts)
    const second = buildZipFilename('2026-01-15', 'Shop', 'image/jpeg', counts)
    const third = buildZipFilename('2026-01-15', 'Shop', 'image/jpeg', counts)
    expect(first).toBe('2026-01-15-Shop.jpg')
    expect(second).toBe('2026-01-15-Shop-1.jpg')
    expect(third).toBe('2026-01-15-Shop-2.jpg')
  })

  it('maps content types to correct extensions', () => {
    const counts: Record<string, number> = {}
    expect(buildZipFilename('2026-01-01', 'A', 'image/jpeg', counts)).toBe('2026-01-01-A.jpg')
    expect(buildZipFilename('2026-01-01', 'B', 'application/pdf', counts)).toBe('2026-01-01-B.pdf')
    expect(buildZipFilename('2026-01-01', 'C', 'image/png', counts)).toBe('2026-01-01-C.png')
    expect(buildZipFilename('2026-01-01', 'D', 'image/webp', counts)).toBe('2026-01-01-D.webp')
  })

  it('falls back to .bin for unknown content types', () => {
    const counts: Record<string, number> = {}
    const result = buildZipFilename('2026-06-01', 'Doc', 'application/octet-stream', counts)
    expect(result).toBe('2026-06-01-Doc.bin')
  })

  it('tracks counts across multiple calls with the same filenameCount map', () => {
    const counts: Record<string, number> = {}
    buildZipFilename('2026-01-01', 'Shop', 'image/jpeg', counts)
    buildZipFilename('2026-01-01', 'Shop', 'image/jpeg', counts)
    expect(counts['2026-01-01-Shop.jpg']).toBe(2)

    buildZipFilename('2026-01-01', 'Other', 'application/pdf', counts)
    expect(counts['2026-01-01-Other.pdf']).toBe(1)

    const next = buildZipFilename('2026-01-01', 'Shop', 'image/jpeg', counts)
    expect(next).toBe('2026-01-01-Shop-2.jpg')
    expect(counts['2026-01-01-Shop.jpg']).toBe(3)
  })
})
