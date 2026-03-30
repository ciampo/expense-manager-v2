import { describe, it, expect } from 'vitest'
import { parseStorageId } from '@/lib/storage'

describe('parseStorageId', () => {
  it('extracts storageId from a valid response', () => {
    expect(parseStorageId({ storageId: 'kg2b0cc21h6gpebf0mfxqjv0dh75gsfg' })).toBe(
      'kg2b0cc21h6gpebf0mfxqjv0dh75gsfg',
    )
  })

  it('throws when storageId is missing', () => {
    expect(() => parseStorageId({})).toThrow('Upload response missing storageId')
  })

  it('throws when storageId is empty string', () => {
    expect(() => parseStorageId({ storageId: '' })).toThrow('Upload response missing storageId')
  })

  it('throws when json is null', () => {
    expect(() => parseStorageId(null)).toThrow('Upload response missing storageId')
  })

  it('throws when json is undefined', () => {
    expect(() => parseStorageId(undefined)).toThrow('Upload response missing storageId')
  })

  it('throws when json is a non-object primitive', () => {
    expect(() => parseStorageId(42)).toThrow('Upload response missing storageId')
    expect(() => parseStorageId('string')).toThrow('Upload response missing storageId')
    expect(() => parseStorageId(true)).toThrow('Upload response missing storageId')
  })

  it('throws when json is an array', () => {
    expect(() => parseStorageId([1, 2, 3])).toThrow('Upload response missing storageId')
  })
})
