// @vitest-environment edge-runtime
import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'
import { api } from './_generated/api'
import schema from './schema'
import type { Id } from './_generated/dataModel'
import { upsertCategory } from './categories'

const modules = import.meta.glob('./**/*.ts')

async function setupAuthenticatedUser(t: ReturnType<typeof convexTest>) {
  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert('users', {})
  })
  const asUser = t.withIdentity({ subject: `${userId}|fake-session` })
  return { userId, asUser }
}

async function insertCategory(
  t: ReturnType<typeof convexTest>,
  fields: { name: string; userId?: Id<'users'>; icon?: string },
) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert('categories', {
      ...fields,
      normalizedName: fields.name.toLowerCase(),
    })
  })
}

async function insertLegacyCategory(
  t: ReturnType<typeof convexTest>,
  fields: { name: string; userId?: Id<'users'>; icon?: string },
) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert('categories', fields)
  })
}

describe('upsertCategory — case-insensitive dedup', () => {
  it('returns existing user category when name differs only by case', async () => {
    const t = convexTest(schema, modules)
    const { userId } = await setupAuthenticatedUser(t)

    const existingId = await insertCategory(t, { name: 'Food', userId })

    const returnedId = await t.run(async (ctx) => {
      return await upsertCategory(ctx, userId, 'food')
    })

    expect(returnedId).toBe(existingId)
  })

  it('returns existing predefined category when name differs only by case', async () => {
    const t = convexTest(schema, modules)
    const { userId } = await setupAuthenticatedUser(t)

    const predefinedId = await insertCategory(t, { name: 'Coworking' })

    const returnedId = await t.run(async (ctx) => {
      return await upsertCategory(ctx, userId, 'coworking')
    })

    expect(returnedId).toBe(predefinedId)
  })

  it('creates a new category when no case-insensitive match exists', async () => {
    const t = convexTest(schema, modules)
    const { userId } = await setupAuthenticatedUser(t)

    await insertCategory(t, { name: 'Food', userId })

    const newId = await t.run(async (ctx) => {
      return await upsertCategory(ctx, userId, 'Transport')
    })

    const created = await t.run(async (ctx) => {
      return await ctx.db.get('categories', newId)
    })
    expect(created).not.toBeNull()
    expect(created!.name).toBe('Transport')
    expect(created!.normalizedName).toBe('transport')
  })
})

describe('categories.create — case-insensitive dedup', () => {
  it('throws when creating a category with same name but different case', async () => {
    const t = convexTest(schema, modules)
    const { userId, asUser } = await setupAuthenticatedUser(t)

    await insertCategory(t, { name: 'Food', userId })

    await expect(asUser.mutation(api.categories.create, { name: 'food' })).rejects.toThrow(
      'Category already exists',
    )
  })

  it('throws when creating a category matching a predefined category (case-insensitive)', async () => {
    const t = convexTest(schema, modules)
    const { asUser } = await setupAuthenticatedUser(t)

    await insertCategory(t, { name: 'Coworking' })

    await expect(asUser.mutation(api.categories.create, { name: 'COWORKING' })).rejects.toThrow(
      'Category already exists',
    )
  })

  it('stores normalizedName on newly created categories', async () => {
    const t = convexTest(schema, modules)
    const { asUser } = await setupAuthenticatedUser(t)

    const categoryId = await asUser.mutation(api.categories.create, {
      name: 'My Category',
    })

    const category = await t.run(async (ctx) => {
      return await ctx.db.get('categories', categoryId)
    })
    expect(category!.normalizedName).toBe('my category')
  })
})

describe('legacy rows without normalizedName', () => {
  it('upsertCategory finds legacy user category by exact name and backfills normalizedName', async () => {
    const t = convexTest(schema, modules)
    const { userId } = await setupAuthenticatedUser(t)

    const legacyId = await insertLegacyCategory(t, { name: 'Food', userId })

    const returnedId = await t.run(async (ctx) => {
      return await upsertCategory(ctx, userId, 'Food')
    })

    expect(returnedId).toBe(legacyId)

    const patched = await t.run(async (ctx) => {
      return await ctx.db.get('categories', legacyId)
    })
    expect(patched!.normalizedName).toBe('food')
  })

  it('upsertCategory finds legacy predefined category by exact name and backfills normalizedName', async () => {
    const t = convexTest(schema, modules)
    const { userId } = await setupAuthenticatedUser(t)

    const legacyId = await insertLegacyCategory(t, { name: 'Coworking' })

    const returnedId = await t.run(async (ctx) => {
      return await upsertCategory(ctx, userId, 'Coworking')
    })

    expect(returnedId).toBe(legacyId)

    const patched = await t.run(async (ctx) => {
      return await ctx.db.get('categories', legacyId)
    })
    expect(patched!.normalizedName).toBe('coworking')
  })

  it('categories.create rejects exact-name duplicate against legacy row', async () => {
    const t = convexTest(schema, modules)
    const { userId, asUser } = await setupAuthenticatedUser(t)

    await insertLegacyCategory(t, { name: 'Food', userId })

    await expect(asUser.mutation(api.categories.create, { name: 'Food' })).rejects.toThrow(
      'Category already exists',
    )
  })
})
