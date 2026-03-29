// @vitest-environment edge-runtime
import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'
import rateLimiterTesting from '@convex-dev/rate-limiter/test'
import schema from './schema'
import { setupAuthenticatedUser, setupApiKey } from './testHelpers'
import type { TestCtx } from './testHelpers'
import { MAX_FILE_SIZE } from './uploadLimits'

const modules = import.meta.glob('./**/*.ts')

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const registerRateLimiter = (t: TestCtx) => rateLimiterTesting.register(t as any)

function makeFile(name: string, type = 'image/jpeg', sizeBytes = 100): File {
  return new File([new Uint8Array(sizeBytes)], name, { type })
}

function buildFormData(files: File[]): FormData {
  const fd = new FormData()
  for (const file of files) {
    fd.append('file', file)
  }
  return fd
}

async function fetchDrafts(
  t: TestCtx,
  options: { rawKey?: string; body?: FormData | string; headers?: Record<string, string> } = {},
) {
  const headers: Record<string, string> = { ...options.headers }
  if (options.rawKey) {
    headers['Authorization'] = `Bearer ${options.rawKey}`
  }
  return await (
    t as never as { fetch: (path: string, init: RequestInit) => Promise<Response> }
  ).fetch('/api/v1/drafts', {
    method: 'POST',
    headers,
    body: options.body,
  })
}

// ── Auth ────────────────────────────────────────────────────────────────

describe('POST /api/v1/drafts — auth', () => {
  it('returns 401 when Authorization header is missing', async () => {
    const t = convexTest(schema, modules)
    registerRateLimiter(t)

    const response = await fetchDrafts(t, {
      body: buildFormData([makeFile('receipt.jpg')]),
    })
    expect(response.status).toBe(401)
    const json = await response.json()
    expect(json.error).toMatch(/authorization/i)
  })

  it('returns 401 when Authorization header has wrong scheme', async () => {
    const t = convexTest(schema, modules)
    registerRateLimiter(t)

    const response = await fetchDrafts(t, {
      headers: { Authorization: 'Basic abc123' },
      body: buildFormData([makeFile('receipt.jpg')]),
    })
    expect(response.status).toBe(401)
  })

  it('returns 401 for an invalid API key', async () => {
    const t = convexTest(schema, modules)
    registerRateLimiter(t)

    const response = await fetchDrafts(t, {
      rawKey: 'em_' + 'f'.repeat(64),
      body: buildFormData([makeFile('receipt.jpg')]),
    })
    expect(response.status).toBe(401)
    const json = await response.json()
    expect(json.error).toMatch(/invalid api key/i)
  })

  it('returns 401 for a malformed API key (wrong prefix)', async () => {
    const t = convexTest(schema, modules)
    registerRateLimiter(t)

    const response = await fetchDrafts(t, {
      rawKey: 'xx_' + 'a'.repeat(64),
      body: buildFormData([makeFile('receipt.jpg')]),
    })
    expect(response.status).toBe(401)
  })

  it('returns 401 for a revoked API key', async () => {
    const t = convexTest(schema, modules)
    registerRateLimiter(t)
    const { userId } = await setupAuthenticatedUser(t)

    const rawKey = await setupApiKey(t, userId)

    await t.run(async (ctx) => {
      const keys = await ctx.db.query('apiKeys').collect()
      for (const key of keys) {
        await ctx.db.delete('apiKeys', key._id)
      }
    })

    const response = await fetchDrafts(t, {
      rawKey,
      body: buildFormData([makeFile('receipt.jpg')]),
    })
    expect(response.status).toBe(401)
  })
})

// ── Request validation ──────────────────────────────────────────────────

describe('POST /api/v1/drafts — request validation', () => {
  it('returns 400 when Content-Type is not multipart/form-data', async () => {
    const t = convexTest(schema, modules)
    registerRateLimiter(t)
    const { userId } = await setupAuthenticatedUser(t)
    const rawKey = await setupApiKey(t, userId)

    const response = await fetchDrafts(t, {
      rawKey,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: [] }),
    })
    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.error).toMatch(/multipart/i)
  })

  it('returns 400 when no files are in the request', async () => {
    const t = convexTest(schema, modules)
    registerRateLimiter(t)
    const { userId } = await setupAuthenticatedUser(t)
    const rawKey = await setupApiKey(t, userId)

    const response = await fetchDrafts(t, {
      rawKey,
      body: buildFormData([]),
    })
    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.error).toMatch(/no files/i)
  })

  it('returns 400 when more than 5 files are submitted', async () => {
    const t = convexTest(schema, modules)
    registerRateLimiter(t)
    const { userId } = await setupAuthenticatedUser(t)
    const rawKey = await setupApiKey(t, userId)

    const files = Array.from({ length: 6 }, (_, i) => makeFile(`file-${i}.jpg`))
    const response = await fetchDrafts(t, {
      rawKey,
      body: buildFormData(files),
    })
    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.error).toMatch(/too many files/i)
  })
})

// ── File validation ─────────────────────────────────────────────────────

describe('POST /api/v1/drafts — file validation', () => {
  it('rejects files with unsupported content types', async () => {
    const t = convexTest(schema, modules)
    registerRateLimiter(t)
    const { userId } = await setupAuthenticatedUser(t)
    const rawKey = await setupApiKey(t, userId)

    const file = new File([new Uint8Array(100)], 'document.txt', { type: 'text/plain' })
    const response = await fetchDrafts(t, {
      rawKey,
      body: buildFormData([file]),
    })
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.created).toHaveLength(0)
    expect(json.errors).toHaveLength(1)
    expect(json.errors[0].filename).toBe('document.txt')
    expect(json.errors[0].error).toMatch(/unsupported file type/i)
  })

  it('rejects files exceeding max size', async () => {
    const t = convexTest(schema, modules)
    registerRateLimiter(t)
    const { userId } = await setupAuthenticatedUser(t)
    const rawKey = await setupApiKey(t, userId)

    const oversizedFile = makeFile('huge.jpg', 'image/jpeg', MAX_FILE_SIZE + 1)
    const response = await fetchDrafts(t, {
      rawKey,
      body: buildFormData([oversizedFile]),
    })
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.created).toHaveLength(0)
    expect(json.errors).toHaveLength(1)
    expect(json.errors[0].filename).toBe('huge.jpg')
    expect(json.errors[0].error).toMatch(/exceeds maximum size/i)
  })

  it('returns mixed results when some files are valid and others are not', async () => {
    const t = convexTest(schema, modules)
    registerRateLimiter(t)
    const { userId } = await setupAuthenticatedUser(t)
    const rawKey = await setupApiKey(t, userId)

    const validFile = makeFile('receipt.jpg', 'image/jpeg')
    const invalidFile = new File([new Uint8Array(100)], 'readme.txt', { type: 'text/plain' })

    const response = await fetchDrafts(t, {
      rawKey,
      body: buildFormData([validFile, invalidFile]),
    })
    const json = await response.json()
    expect(response.status).toBe(201)
    expect(json.created).toHaveLength(1)
    expect(json.created[0].filename).toBe('receipt.jpg')
    expect(json.errors).toHaveLength(1)
    expect(json.errors[0].filename).toBe('readme.txt')
  })
})

// ── Successful draft creation ───────────────────────────────────────────

describe('POST /api/v1/drafts — draft creation', () => {
  it('creates 1 draft from 1 valid file', async () => {
    const t = convexTest(schema, modules)
    registerRateLimiter(t)
    const { userId } = await setupAuthenticatedUser(t)
    const rawKey = await setupApiKey(t, userId)

    const response = await fetchDrafts(t, {
      rawKey,
      body: buildFormData([makeFile('receipt.jpg')]),
    })
    expect(response.status).toBe(201)
    const json = await response.json()
    expect(json.created).toHaveLength(1)
    expect(json.created[0].filename).toBe('receipt.jpg')
    expect(json.created[0].id).toBeTruthy()
    expect(json.errors).toHaveLength(0)
  })

  it('creates 3 drafts from 3 valid files', async () => {
    const t = convexTest(schema, modules)
    registerRateLimiter(t)
    const { userId } = await setupAuthenticatedUser(t)
    const rawKey = await setupApiKey(t, userId)

    const files = [
      makeFile('receipt1.jpg', 'image/jpeg'),
      makeFile('receipt2.png', 'image/png'),
      makeFile('invoice.pdf', 'application/pdf'),
    ]
    const response = await fetchDrafts(t, {
      rawKey,
      body: buildFormData(files),
    })
    expect(response.status).toBe(201)
    const json = await response.json()
    expect(json.created).toHaveLength(3)
    expect(json.created.map((c: { filename: string }) => c.filename)).toEqual([
      'receipt1.jpg',
      'receipt2.png',
      'invoice.pdf',
    ])
    expect(json.errors).toHaveLength(0)
  })

  it('created drafts have isDraft: true and correct attachmentId', async () => {
    const t = convexTest(schema, modules)
    registerRateLimiter(t)
    const { userId } = await setupAuthenticatedUser(t)
    const rawKey = await setupApiKey(t, userId)

    const response = await fetchDrafts(t, {
      rawKey,
      body: buildFormData([makeFile('receipt.jpg')]),
    })
    const json = await response.json()
    const expenseId = json.created[0].id

    const expense = await t.run(async (ctx) => {
      return await ctx.db.get('expenses', expenseId as never)
    })

    expect(expense).not.toBeNull()
    expect(expense!.isDraft).toBe(true)
    expect(expense!.userId).toBe(userId)
    expect(expense!.attachmentId).toBeTruthy()
  })

  it('updates lastUsedAt on the API key after successful auth', async () => {
    const t = convexTest(schema, modules)
    registerRateLimiter(t)
    const { userId } = await setupAuthenticatedUser(t)
    const rawKey = await setupApiKey(t, userId)

    const keyBefore = await t.run(async (ctx) => {
      return await ctx.db.query('apiKeys').first()
    })
    expect(keyBefore!.lastUsedAt).toBeUndefined()

    await fetchDrafts(t, {
      rawKey,
      body: buildFormData([makeFile('receipt.jpg')]),
    })

    const keyAfter = await t.run(async (ctx) => {
      return await ctx.db.query('apiKeys').first()
    })
    expect(keyAfter!.lastUsedAt).toBeTypeOf('number')
  })
})

// ── Rate limiting ───────────────────────────────────────────────────────

describe('POST /api/v1/drafts — rate limiting', () => {
  it('returns 429 with Retry-After header after exceeding rate limit', async () => {
    const t = convexTest(schema, modules)
    registerRateLimiter(t)
    const { userId } = await setupAuthenticatedUser(t)
    const rawKey = await setupApiKey(t, userId)

    for (let i = 0; i < 5; i++) {
      const res = await fetchDrafts(t, {
        rawKey,
        body: buildFormData([makeFile(`file-${i}.jpg`)]),
      })
      expect(res.status).not.toBe(429)
    }

    const response = await fetchDrafts(t, {
      rawKey,
      body: buildFormData([makeFile('one-too-many.jpg')]),
    })
    expect(response.status).toBe(429)
    const json = await response.json()
    expect(json.error).toMatch(/rate limit/i)
    expect(Number(response.headers.get('Retry-After'))).toBeGreaterThan(0)
  })
})
