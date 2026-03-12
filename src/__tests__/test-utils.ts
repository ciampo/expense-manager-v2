import { expect } from 'vitest'

type SafeParsable = {
  safeParse: (v: unknown) => {
    success: boolean
    data?: unknown
    error?: { issues: Array<{ message: string; path: (string | number)[] }> }
  }
}

export function expectSuccess(schema: SafeParsable, value: unknown) {
  const result = schema.safeParse(value)
  expect(result.success).toBe(true)
  return result
}

export function expectFailure(schema: SafeParsable, value: unknown) {
  const result = schema.safeParse(value)
  expect(result.success).toBe(false)
  return result
}

export function getErrorMessages(schema: SafeParsable, value: unknown): string[] {
  const result = schema.safeParse(value)
  if (result.success) return []
  return result.error!.issues.map((i) => i.message)
}
