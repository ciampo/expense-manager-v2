import { httpAction } from './_generated/server'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { validateFileMetadata } from './storage'
import { rateLimiter, formatRetryDelay } from './rateLimits'

const MAX_FILES_PER_REQUEST = 5

function jsonResponse(
  body: unknown,
  status: number,
  extraHeaders?: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  })
}

/**
 * POST /api/v1/drafts — bulk-create draft expenses from uploaded files.
 *
 * Authentication: `Authorization: Bearer em_xxx` (API key).
 * Body: `multipart/form-data` with up to {@link MAX_FILES_PER_REQUEST} file parts.
 *
 * Returns `{ created, errors }` where each entry maps to a submitted file.
 */
export const bulkCreateDrafts = httpAction(async (ctx, request) => {
  // ── Auth ──────────────────────────────────────────────────────────────
  const authHeader = request.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Missing or malformed Authorization header' }, 401)
  }

  const rawKey = authHeader.slice('Bearer '.length)

  const userId = await ctx.runMutation(internal.apiKeys.verify, { rawKey })
  if (!userId) {
    return jsonResponse({ error: 'Invalid API key' }, 401)
  }

  // ── Rate limit ────────────────────────────────────────────────────────
  const { ok, retryAfter } = await rateLimiter.limit(ctx, 'apiDraftUpload', {
    key: userId,
  })
  if (!ok) {
    return jsonResponse(
      { error: `Rate limit exceeded. Try again in ${formatRetryDelay(retryAfter)}.` },
      429,
      { 'Retry-After': String(Math.ceil(retryAfter / 1000)) },
    )
  }

  // ── Parse multipart body ──────────────────────────────────────────────
  const contentType = request.headers.get('Content-Type') ?? ''
  if (!contentType.includes('multipart/form-data')) {
    return jsonResponse({ error: 'Content-Type must be multipart/form-data' }, 400)
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return jsonResponse({ error: 'Failed to parse multipart body' }, 400)
  }

  const files: File[] = []
  for (const [, value] of formData.entries()) {
    if (value instanceof File) {
      files.push(value)
    }
  }

  if (files.length === 0) {
    return jsonResponse({ error: 'No files in request' }, 400)
  }

  if (files.length > MAX_FILES_PER_REQUEST) {
    return jsonResponse(
      { error: `Too many files. Maximum ${MAX_FILES_PER_REQUEST} per request.` },
      400,
    )
  }

  // ── Validate & store files ────────────────────────────────────────────
  const validStorageIds: { storageId: Id<'_storage'>; filename: string }[] = []
  const errors: { filename: string; error: string }[] = []

  for (const file of files) {
    const filename = file.name || 'unnamed'
    const validationError = validateFileMetadata({
      size: file.size,
      contentType: file.type || null,
    })

    if (validationError) {
      errors.push({ filename, error: validationError })
      continue
    }

    try {
      const storageId = await ctx.storage.store(file)
      validStorageIds.push({ storageId, filename })
    } catch {
      errors.push({ filename, error: 'Failed to store file' })
    }
  }

  // ── Create drafts ────────────────────────────────────────────────────
  if (validStorageIds.length === 0) {
    return jsonResponse({ created: [], errors }, 200)
  }

  const expenseIds = await ctx.runMutation(internal.expenses.createDraftsBulk, {
    storageIds: validStorageIds.map((v) => v.storageId),
    userId,
  })

  const created = expenseIds.map((id, i) => ({
    id,
    filename: validStorageIds[i].filename,
  }))

  return jsonResponse({ created, errors }, 201)
})
