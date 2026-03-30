import { readFileSync } from 'node:fs'

export const CSV_HEADER =
  'giorno,descrizione,aliquota,imponibile,imposta,imponibile,imposta,totale spese documentate'

export function parseCsvLines(filePath: string): string[] {
  return readFileSync(filePath, 'utf-8')
    .replace(/^\uFEFF/, '')
    .split('\r\n')
    .filter(Boolean)
}
