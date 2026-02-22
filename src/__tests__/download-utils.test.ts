import { describe, it, expect, vi } from 'vitest'
import {
  extensionFromContentType,
  promiseAllSettledPooled,
} from '@/lib/download-utils'

describe('extensionFromContentType', () => {
  it('returns .jpg for image/jpeg', () => {
    expect(extensionFromContentType('image/jpeg')).toBe('.jpg')
  })

  it('returns .jpg for non-standard image/jpg', () => {
    expect(extensionFromContentType('image/jpg')).toBe('.jpg')
  })

  it('returns .jpg for legacy image/pjpeg (progressive JPEG from IE)', () => {
    expect(extensionFromContentType('image/pjpeg')).toBe('.jpg')
  })

  it('returns .png for image/png', () => {
    expect(extensionFromContentType('image/png')).toBe('.png')
  })

  it('returns .png for legacy image/x-png', () => {
    expect(extensionFromContentType('image/x-png')).toBe('.png')
  })

  it('returns .gif for image/gif', () => {
    expect(extensionFromContentType('image/gif')).toBe('.gif')
  })

  it('returns .webp for image/webp', () => {
    expect(extensionFromContentType('image/webp')).toBe('.webp')
  })

  it('returns .pdf for application/pdf', () => {
    expect(extensionFromContentType('application/pdf')).toBe('.pdf')
  })

  it('is case-insensitive', () => {
    expect(extensionFromContentType('Image/JPEG')).toBe('.jpg')
    expect(extensionFromContentType('APPLICATION/PDF')).toBe('.pdf')
    expect(extensionFromContentType('image/PNG')).toBe('.png')
  })

  it('strips parameters before matching', () => {
    expect(extensionFromContentType('image/jpeg; charset=binary')).toBe('.jpg')
    expect(extensionFromContentType('application/pdf; name=file.pdf')).toBe('.pdf')
  })

  it('returns .bin for unknown content types', () => {
    expect(extensionFromContentType('application/octet-stream')).toBe('.bin')
    expect(extensionFromContentType('text/html')).toBe('.bin')
  })

  it('returns .bin for empty or malformed input', () => {
    expect(extensionFromContentType('')).toBe('.bin')
    expect(extensionFromContentType('not-a-mime-type')).toBe('.bin')
  })

  it('does not false-positive on substrings', () => {
    expect(extensionFromContentType('application/something-jpeg-encoded')).toBe('.bin')
    expect(extensionFromContentType('application/png-archive')).toBe('.bin')
  })
})

describe('promiseAllSettledPooled', () => {
  it('returns an empty array for no tasks', async () => {
    const results = await promiseAllSettledPooled([], 5)
    expect(results).toEqual([])
  })

  it('resolves all fulfilled tasks', async () => {
    const tasks = [
      () => Promise.resolve('a'),
      () => Promise.resolve('b'),
      () => Promise.resolve('c'),
    ]
    const results = await promiseAllSettledPooled(tasks, 2)
    expect(results).toEqual([
      { status: 'fulfilled', value: 'a' },
      { status: 'fulfilled', value: 'b' },
      { status: 'fulfilled', value: 'c' },
    ])
  })

  it('captures rejected tasks without aborting others', async () => {
    const tasks = [
      () => Promise.resolve('ok'),
      () => Promise.reject(new Error('fail')),
      () => Promise.resolve('also ok'),
    ]
    const results = await promiseAllSettledPooled(tasks, 5)
    expect(results[0]).toEqual({ status: 'fulfilled', value: 'ok' })
    expect(results[1]).toEqual(
      expect.objectContaining({ status: 'rejected' })
    )
    expect((results[1] as PromiseRejectedResult).reason).toBeInstanceOf(Error)
    expect(results[2]).toEqual({ status: 'fulfilled', value: 'also ok' })
  })

  it('preserves result order matching task order', async () => {
    const tasks = [
      () => new Promise<number>((resolve) => setTimeout(() => resolve(3), 30)),
      () => new Promise<number>((resolve) => setTimeout(() => resolve(1), 10)),
      () => new Promise<number>((resolve) => setTimeout(() => resolve(2), 20)),
    ]
    const results = await promiseAllSettledPooled(tasks, 3)
    expect(results.map((r) => (r as PromiseFulfilledResult<number>).value)).toEqual([3, 1, 2])
  })

  it('respects the concurrency limit', async () => {
    let concurrent = 0
    let maxConcurrent = 0

    const makeTask = () => async () => {
      concurrent++
      maxConcurrent = Math.max(maxConcurrent, concurrent)
      await new Promise((resolve) => setTimeout(resolve, 10))
      concurrent--
      return 'done'
    }

    const tasks = Array.from({ length: 10 }, () => makeTask())
    await promiseAllSettledPooled(tasks, 3)

    expect(maxConcurrent).toBeLessThanOrEqual(3)
    expect(maxConcurrent).toBeGreaterThan(1)
  })

  it('handles limit larger than task count', async () => {
    const tasks = [() => Promise.resolve(1), () => Promise.resolve(2)]
    const results = await promiseAllSettledPooled(tasks, 100)
    expect(results).toHaveLength(2)
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true)
  })

  it('warns and returns empty array for non-positive limit', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const results = await promiseAllSettledPooled(
      [() => Promise.resolve('should not run')],
      0
    )
    expect(results).toEqual([])
    expect(warnSpy).toHaveBeenCalledOnce()

    warnSpy.mockRestore()
  })

  it('warns and returns empty array for negative limit', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const results = await promiseAllSettledPooled(
      [() => Promise.resolve('x')],
      -1
    )
    expect(results).toEqual([])
    expect(warnSpy).toHaveBeenCalledOnce()

    warnSpy.mockRestore()
  })
})
