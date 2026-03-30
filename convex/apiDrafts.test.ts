// @vitest-environment edge-runtime
import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'
import { api } from './_generated/api'
import schema from './schema'
import rateLimiterTesting from '@convex-dev/rate-limiter/test'
import { fetchApi, setupAuthenticatedUser, setupApiKey } from './testHelpers'
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

function fetchDrafts(
  t: TestCtx,
  options: { rawKey?: string; body?: FormData | string; headers?: Record<string, string> } = {},
) {
  const headers: Record<string, string> = { ...options.headers }
  if (options.rawKey) {
    headers['Authorization'] = `Bearer ${options.rawKey}`
  }
  return fetchApi(t, '/api/v1/drafts', {
    method: 'POST',
    headers,
    body: options.body,
  })
}

function expectJsonContentType(response: Response) {
  expect(response.headers.get('Content-Type')).toBe('application/json')
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
    expectJsonContentType(response)
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
    expectJsonContentType(response)
    const json = await response.json()
    expect(json.error).toMatch(/authorization/i)
  })

  it('returns 401 for an invalid API key', async () => {
    const t = convexTest(schema, modules)
    registerRateLimiter(t)

    const response = await fetchDrafts(t, {
      rawKey: 'em_' + 'f'.repeat(64),
      body: buildFormData([makeFile('receipt.jpg')]),
    })
    expect(response.status).toBe(401)
    expectJsonContentType(response)
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
    expectJsonContentType(response)
    const json = await response.json()
    expect(json.error).toMatch(/invalid api key/i)
  })

  it('returns 401 for a revoked API key', async () => {
    const t = convexTest(schema, modules)
    registerRateLimiter(t)
    const { userId, asUser } = await setupAuthenticatedUser(t)

    const rawKey = await setupApiKey(t, userId)

    const keys = await asUser.query(api.apiKeys.list, {})
    await asUser.mutation(api.apiKeys.revoke, { id: keys[0]._id })

    const response = await fetchDrafts(t, {
      rawKey,
      body: buildFormData([makeFile('receipt.jpg')]),
    })
    expect(response.status).toBe(401)
    expectJsonContentType(response)
    const json = await response.json()
    expect(json.error).toMatch(/invalid api key/i)
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
    expectJsonContentType(response)
    const json = await response.json()
    expect(json.error).toMatch(/multipart/i)
  })

  it('returns 400 when form data contains only text fields (no files)', async () => {
    const t = convexTest(schema, modules)
    registerRateLimiter(t)
    const { userId } = await setupAuthenticatedUser(t)
    const rawKey = await setupApiKey(t, userId)

    const fd = new FormData()
    fd.append('name', 'not-a-file')
    fd.append('description', 'also not a file')

    const response = await fetchDrafts(t, { rawKey, body: fd })
    expect(response.status).toBe(400)
    expectJsonContentType(response)
    const json = await response.json()
    expect(json.error).toMatch(/no files/i)
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
    expectJsonContentType(response)
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
    expectJsonContentType(response)
    const json = await response.json()
    expect(json.error).toMatch(/too many files/i)
  })

  it('accepts exactly 5 files (boundary)', async () => {
    const t = convexTest(schema, modules)
    registerRateLimiter(t)
    const { userId } = await setupAuthenticatedUser(t)
    const rawKey = await setupApiKey(t, userId)

    const files = Array.from({ length: 5 }, (_, i) => makeFile(`file-${i}.jpg`))
    const response = await fetchDrafts(t, {
      rawKey,
      body: buildFormData(files),
    })
    expect(response.status).toBe(201)
    expectJsonContentType(response)
    const json = await response.json()
    expect(json.created).toHaveLength(5)
    expect(json.errors).toHaveLength(0)
  })
})

// ── File validation ─────────────────────────────────────────────────────

describe('POST /api/v1/drafts — file validation', () => {
  it('rejects files with unsupported content types without creating any DB records', async () => {
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
    expectJsonContentType(response)
    const json = await response.json()
    expect(json.created).toHaveLength(0)
    expect(json.errors).toHaveLength(1)
    expect(json.errors[0]).toEqual({
      filename: 'document.txt',
      error: expect.stringMatching(/unsupported file type/i),
    })

    // Verify no expenses or uploads were created
    const expenses = await t.run(async (ctx) => ctx.db.query('expenses').collect())
    expect(expenses).toHaveLength(0)
    const uploads = await t.run(async (ctx) => ctx.db.query('uploads').collect())
    expect(uploads).toHaveLength(0)
  })

  it('rejects files exceeding max size without creating any DB records', async () => {
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
    expectJsonContentType(response)
    const json = await response.json()
    expect(json.created).toHaveLength(0)
    expect(json.errors).toHaveLength(1)
    expect(json.errors[0]).toEqual({
      filename: 'huge.jpg',
      error: expect.stringMatching(/exceeds maximum size/i),
    })

    // Verify no expenses or uploads were created
    const expenses = await t.run(async (ctx) => ctx.db.query('expenses').collect())
    expect(expenses).toHaveLength(0)
  })

  it('returns mixed results: valid files create drafts, invalid files appear in errors', async () => {
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
    expect(response.status).toBe(201)
    expectJsonContentType(response)
    const json = await response.json()
    expect(json.created).toHaveLength(1)
    expect(json.created[0].filename).toBe('receipt.jpg')
    expect(json.errors).toHaveLength(1)
    expect(json.errors[0].filename).toBe('readme.txt')

    // Verify exactly 1 expense and 1 upload were created
    const expenses = await t.run(async (ctx) => ctx.db.query('expenses').collect())
    expect(expenses).toHaveLength(1)
    expect(expenses[0].isDraft).toBe(true)
    const uploads = await t.run(async (ctx) => ctx.db.query('uploads').collect())
    expect(uploads).toHaveLength(1)
  })
})

describe('POST /api/v1/drafts — status code contract', () => {
  it('returns 200 (not 201) when all files fail validation', async () => {
    const t = convexTest(schema, modules)
    registerRateLimiter(t)
    const { userId } = await setupAuthenticatedUser(t)
    const rawKey = await setupApiKey(t, userId)

    const files = [
      new File([new Uint8Array(100)], 'a.txt', { type: 'text/plain' }),
      new File([new Uint8Array(100)], 'b.zip', { type: 'application/zip' }),
    ]
    const response = await fetchDrafts(t, {
      rawKey,
      body: buildFormData(files),
    })
    expect(response.status).toBe(200)
    expectJsonContentType(response)
    const json = await response.json()
    expect(json.created).toHaveLength(0)
    expect(json.errors).toHaveLength(2)
  })

  it('returns 201 when at least one file succeeds (even if others fail)', async () => {
    const t = convexTest(schema, modules)
    registerRateLimiter(t)
    const { userId } = await setupAuthenticatedUser(t)
    const rawKey = await setupApiKey(t, userId)

    const files = [
      makeFile('good.jpg', 'image/jpeg'),
      new File([new Uint8Array(100)], 'bad.txt', { type: 'text/plain' }),
    ]
    const response = await fetchDrafts(t, {
      rawKey,
      body: buildFormData(files),
    })
    expect(response.status).toBe(201)
    expectJsonContentType(response)
    const json = await response.json()
    expect(json.created).toHaveLength(1)
    expect(json.errors).toHaveLength(1)
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
    expectJsonContentType(response)
    const json = await response.json()
    expect(json.created).toHaveLength(1)
    expect(json.created[0]).toEqual({
      id: expect.any(String),
      filename: 'receipt.jpg',
    })
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
    expectJsonContentType(response)
    const json = await response.json()
    expect(json.created).toHaveLength(3)
    expect(json.created.map((c: { filename: string }) => c.filename)).toEqual([
      'receipt1.jpg',
      'receipt2.png',
      'invoice.pdf',
    ])
    expect(json.errors).toHaveLength(0)
  })

  it('created drafts have isDraft: true, correct userId, and a valid attachment in storage', async () => {
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

    // Verify the referenced file actually exists in storage
    const fileMetadata = await t.run(async (ctx) => {
      return await ctx.db.system.get(expense!.attachmentId!)
    })
    expect(fileMetadata).not.toBeNull()
  })

  it('creates upload ownership records alongside drafts', async () => {
    const t = convexTest(schema, modules)
    registerRateLimiter(t)
    const { userId } = await setupAuthenticatedUser(t)
    const rawKey = await setupApiKey(t, userId)

    const response = await fetchDrafts(t, {
      rawKey,
      body: buildFormData([makeFile('a.jpg'), makeFile('b.png')]),
    })
    const json = await response.json()
    expect(json.created).toHaveLength(2)

    // Verify upload records exist for each created draft
    const uploads = await t.run(async (ctx) => ctx.db.query('uploads').collect())
    expect(uploads).toHaveLength(2)
    expect(uploads.every((u) => u.userId === userId)).toBe(true)

    // Each upload's storageId should match an expense's attachmentId
    const expenses = await t.run(async (ctx) => ctx.db.query('expenses').collect())
    const attachmentIds = new Set(expenses.map((e) => e.attachmentId))
    for (const upload of uploads) {
      expect(attachmentIds.has(upload.storageId)).toBe(true)
    }
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
    expectJsonContentType(response)
    const json = await response.json()
    expect(json.error).toMatch(/rate limit/i)
    expect(Number(response.headers.get('Retry-After'))).toBeGreaterThan(0)
  })
})
