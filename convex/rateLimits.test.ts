// @vitest-environment edge-runtime
import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'
import { api } from './_generated/api'
import schema from './schema'
import rateLimiterTesting from '@convex-dev/rate-limiter/test'
import type { TestCtx } from './testHelpers'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const registerRateLimiter = (t: TestCtx) => rateLimiterTesting.register(t as any)

const modules = import.meta.glob('./**/*.ts')

describe('consumePasswordResetRateLimit', () => {
  it('allows requests under the limit', async () => {
    const t = convexTest(schema, modules)
    registerRateLimiter(t)

    await expect(
      t.mutation(api.rateLimits.consumePasswordResetRateLimit, {
        email: 'user@example.com',
      }),
    ).resolves.not.toThrow()
  })

  it('allows up to 3 requests per hour', async () => {
    const t = convexTest(schema, modules)
    registerRateLimiter(t)

    for (let i = 0; i < 3; i++) {
      await t.mutation(api.rateLimits.consumePasswordResetRateLimit, {
        email: 'user@example.com',
      })
    }
  })

  it('throws when the limit is exceeded', async () => {
    const t = convexTest(schema, modules)
    registerRateLimiter(t)

    for (let i = 0; i < 3; i++) {
      await t.mutation(api.rateLimits.consumePasswordResetRateLimit, {
        email: 'user@example.com',
      })
    }

    await expect(
      t.mutation(api.rateLimits.consumePasswordResetRateLimit, {
        email: 'user@example.com',
      }),
    ).rejects.toThrow(/too many password reset attempts/i)
  })

  it('normalizes emails so different casing shares the same limit', async () => {
    const t = convexTest(schema, modules)
    registerRateLimiter(t)

    await t.mutation(api.rateLimits.consumePasswordResetRateLimit, {
      email: 'User@Example.COM',
    })
    await t.mutation(api.rateLimits.consumePasswordResetRateLimit, {
      email: 'user@example.com',
    })
    await t.mutation(api.rateLimits.consumePasswordResetRateLimit, {
      email: '  USER@EXAMPLE.COM  ',
    })

    await expect(
      t.mutation(api.rateLimits.consumePasswordResetRateLimit, {
        email: 'user@example.com',
      }),
    ).rejects.toThrow(/too many password reset attempts/i)
  })

  it('silently ignores invalid email formats without consuming a token', async () => {
    const t = convexTest(schema, modules)
    registerRateLimiter(t)

    const invalidEmails = ['', 'not-an-email', 'a'.repeat(321) + '@x.com', '@missing-local.com']
    for (const email of invalidEmails) {
      await expect(
        t.mutation(api.rateLimits.consumePasswordResetRateLimit, { email }),
      ).resolves.not.toThrow()
    }
  })

  it('tracks different emails independently', async () => {
    const t = convexTest(schema, modules)
    registerRateLimiter(t)

    for (let i = 0; i < 3; i++) {
      await t.mutation(api.rateLimits.consumePasswordResetRateLimit, {
        email: 'alice@example.com',
      })
    }

    await expect(
      t.mutation(api.rateLimits.consumePasswordResetRateLimit, {
        email: 'bob@example.com',
      }),
    ).resolves.not.toThrow()
  })
})
