import type { Id } from '../../convex/_generated/dataModel'

/**
 * Extract and validate `storageId` from a Convex upload endpoint response.
 * Throws with a debuggable message when the field is missing or empty.
 */
export function parseStorageId(json: unknown): Id<'_storage'> {
  const storageId = (json as { storageId?: string })?.storageId
  if (!storageId) {
    throw new Error('Upload response missing storageId')
  }
  return storageId as Id<'_storage'>
}
