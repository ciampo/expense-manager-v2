// @vitest-environment edge-runtime
import { convexTest } from 'convex-test'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { internal } from './_generated/api'
import schema from './schema'
import { setupAuthenticatedUser, setupCategory, insertExpense } from './testHelpers'

const modules = import.meta.glob('./**/*.ts')

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('seed:cleanup — E2E_CLEANUP_ALLOWED guardrail', () => {
  it('rejects when E2E_CLEANUP_ALLOWED is not set', async () => {
    vi.stubEnv('E2E_CLEANUP_ALLOWED', '')
    const t = convexTest(schema, modules)

    await expect(t.mutation(internal.seed.cleanup, {})).rejects.toThrow('E2E_CLEANUP_ALLOWED')
  })

  it('rejects when E2E_CLEANUP_ALLOWED is set to a wrong value', async () => {
    vi.stubEnv('E2E_CLEANUP_ALLOWED', 'false')
    const t = convexTest(schema, modules)

    await expect(t.mutation(internal.seed.cleanup, {})).rejects.toThrow('E2E_CLEANUP_ALLOWED')
  })

  it('succeeds when E2E_CLEANUP_ALLOWED is "true"', async () => {
    vi.stubEnv('E2E_CLEANUP_ALLOWED', 'true')
    const t = convexTest(schema, modules)

    const result = await t.mutation(internal.seed.cleanup, {})
    expect(result).toEqual({ success: true, message: 'E2E test data and auth users cleaned up' })
  })

  it('deletes all user data when allowed', async () => {
    vi.stubEnv('E2E_CLEANUP_ALLOWED', 'true')
    const t = convexTest(schema, modules)
    const { userId } = await setupAuthenticatedUser(t)
    const catId = await setupCategory(t, userId)
    await insertExpense(t, userId, catId)
    await t.run(async (ctx) => {
      await ctx.db.insert('merchants', {
        name: 'Test Merchant',
        normalizedName: 'test merchant',
        userId,
      })
    })

    await t.mutation(internal.seed.cleanup, {})

    const remaining = await t.run(async (ctx) => ({
      expenses: await ctx.db.query('expenses').collect(),
      merchants: await ctx.db.query('merchants').collect(),
    }))
    expect(remaining.expenses).toHaveLength(0)
    expect(remaining.merchants).toHaveLength(0)
  })
})
