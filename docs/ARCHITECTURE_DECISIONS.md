# Architecture Decisions

Pragmatic trade-offs made for a **personal expense manager** with bounded
data volumes (single or very few users, hundreds to low-thousands of
expenses). Each decision notes what to revisit if the app scales.

---

## 1. Denormalized merchant names on expenses

Merchants are stored as free-text `string` fields on the `expenses` table
rather than as foreign-key `Id<'merchants'>` references.

**Why:** The merchant field was part of the original schema before merchant
management was added. Keeping it as a string avoids a data migration and
lets the expense form remain a simple text input with autocomplete.

**Trade-off:** Merchant renames, reference checks, and orphan cleanup
require full-collection scans filtered in memory (O(user's total expenses)
per operation).

**At scale:** Normalize to a `merchantId: v.id('merchants')` foreign key
with a `by_merchant` index on expenses, mirroring the category pattern.

---

## 2. Category vs. merchant orphan detection asymmetry

Categories use a `by_category` index on expenses, enabling O(1) `.first()`
existence checks. Merchants lack an equivalent index because the stored
value is a free-text string — indexing would require adding a normalized
`merchantName` field to expenses.

**Why:** Adding a denormalized `normalizedMerchantName` field just for
indexing would add complexity (keeping it in sync on every expense write)
for minimal gain at current scale.

**At scale:** If merchant reference checks become a bottleneck, either
normalize to `merchantId` (decision 1) or add a `normalizedMerchantName`
field with an index.

---

## 3. Cron cleanup batches by deletion count

The orphan cleanup crons `.collect()` all relevant records but cap
_deletions_ per run at 100 (`CLEANUP_BATCH_SIZE`).

**Why:** An earlier approach used `.take(CLEANUP_BATCH_SIZE)` on the query,
which caused "batch starvation" — the same non-orphaned rows were
re-checked on every run, and actual orphans beyond the batch window were
never reached.

The merchant cron groups merchants by `userId` and loads each user's
expenses once, avoiding an N+1 query pattern.

**At scale:** Implement cursor-based pagination that persists the last
processed document ID between runs, so each run picks up where the
previous one left off.

---

## 4. In-memory aggregation for entity counts

`categories.listWithCounts` and `merchants.listWithCounts` fetch all of a
user's expenses once and aggregate counts in memory. This avoids N+1
per-entity queries but loads the full expense set into memory.

**Why:** A single collection + in-memory Map is simpler and faster than N
indexed queries for the expected data volumes. Convex query functions have
memory limits, but a personal app won't approach them.

**At scale:** Maintain incremental counters (update on
create/update/delete) or use indexed queries with `.count()` if Convex
adds native count support.

---

## 5. Synchronous unbatched merchant rename

The `merchants.rename` mutation patches all matching expenses in a single
transaction. There is no background job or chunked processing.

**Why:** Convex mutations are transactional and retry-safe. For bounded
expense counts, a single-pass rename is simpler and provides immediate
consistency. Background batching would add complexity (partial rename
states, retry logic) for no practical benefit.

**At scale:** Move to an `internalMutation` that processes expenses in
chunks of ~100, scheduled via `ctx.scheduler.runAfter`, with the merchant
record updated first and a "renaming in progress" flag to prevent
concurrent edits.

---

## 6. Synchronous auth route guards (TanStack Router `beforeLoad`)

Auth-protected routes (`_authenticated.tsx`, `_auth.tsx`) use **synchronous
`beforeLoad` guards** that read the in-memory `authStore` rather than
awaiting an async auth check.

```
beforeLoad  →  read authStore.isLoading / isAuthenticated  →  redirect or proceed
component   →  if isLoading, render skeleton; else render content
AuthBridge  →  when auth settles, calls router.invalidate()
              → beforeLoad re-runs with settled state → redirects fire
```

**Why:** An earlier implementation used `async beforeLoad` that awaited
`authStore.waitForAuth()` — a promise that resolved when Convex auth
finished loading. This worked until TanStack Router 1.167.0 refactored
`loadMatches` for the new `staleReloadMode` feature
([TanStack/router#6921](https://github.com/TanStack/router/pull/6921)).
`router.invalidate()` (called by `AuthBridge` when auth settles) during
an in-flight `async beforeLoad` triggered two concurrent `load()` cycles
sharing internal `_nonReactive` promise state, effectively doubling every
navigation's cost.

The synchronous pattern follows the
[recommended TanStack Router auth guide](https://tanstack.com/router/latest/docs/guide/authenticated-routes):
`beforeLoad` checks auth state without blocking, the component handles the
loading state with a skeleton, and `router.invalidate()` causes re-evaluation
only after auth settles — no concurrent loads possible.

**Trade-off:** The component briefly mounts and shows a skeleton before the
auth state settles. This is indistinguishable to the user from the previous
`pendingComponent` approach and avoids the race condition entirely.

**`waitForAuth` retained:** The async `waitForAuth()` method on `AuthStore`
is kept as a utility for any future non-React code that truly needs to await
auth resolution (e.g. external integrations, CLI scripts), but it is no
longer used by route guards.

---

## 7. Merchant cleanup deferred on expense update

When an expense's merchant changes, the old merchant record is **not**
immediately cleaned up. Cleanup only runs immediately on expense
**deletion**; for updates, the daily cron handles orphaned merchants.

**Why:** Immediate cleanup on update would remove the old merchant from the
autocomplete list, but the user likely still wants it available for future
expenses. This matches the expectation that previously-used merchants
remain in autocomplete suggestions. Category cleanup on update is kept
because categories are structural entities explicitly selected from a list,
not free-text input.

**Trade-off:** A merchant record may linger for up to 24 hours after it
becomes orphaned via an update. This is acceptable — the daily cron
provides the safety net.
