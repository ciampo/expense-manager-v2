// Maps MIME subtypes to file extensions. Non-standard aliases like 'jpg'
// (standard is 'jpeg'), 'pjpeg' (progressive JPEG from legacy IE), and
// 'x-png' (early unofficial PNG type) are included for robustness.
const SUBTYPE_EXTENSIONS: Record<string, string> = {
  jpeg: '.jpg',
  jpg: '.jpg',
  pjpeg: '.jpg',
  png: '.png',
  'x-png': '.png',
  gif: '.gif',
  webp: '.webp',
  pdf: '.pdf',
}

export function extensionFromContentType(contentType: string): string {
  // "image/jpeg; charset=binary" → "image/jpeg" → "jpeg"
  const [typeAndSubtype] = contentType.toLowerCase().split(';', 1)
  const subtype = typeAndSubtype.trim().split('/')[1]?.trim()
  if (subtype) {
    const ext = SUBTYPE_EXTENSIONS[subtype]
    if (ext) return ext
  }
  return '.bin'
}

/**
 * Like Promise.allSettled, but limits concurrency to `limit` tasks at a time.
 * Returns an empty array when there are no tasks. Warns and returns an empty
 * array if `limit` is non-positive (caller bug).
 */
export async function promiseAllSettledPooled<T>(
  tasks: (() => Promise<T>)[],
  limit: number
): Promise<PromiseSettledResult<T>[]> {
  if (tasks.length === 0) return []
  if (limit <= 0) {
    console.warn('promiseAllSettledPooled called with non-positive limit', {
      limit,
      taskCount: tasks.length,
    })
    return []
  }

  const results: PromiseSettledResult<T>[] = new Array(tasks.length)
  let nextIndex = 0

  async function worker() {
    while (nextIndex < tasks.length) {
      const i = nextIndex++
      try {
        results[i] = { status: 'fulfilled', value: await tasks[i]() }
      } catch (reason) {
        results[i] = { status: 'rejected', reason }
      }
    }
  }

  const workerCount = Math.min(limit, tasks.length)
  await Promise.all(Array.from({ length: workerCount }, () => worker()))
  return results
}
