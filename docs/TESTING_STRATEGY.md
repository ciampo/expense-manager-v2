# Testing Strategy

How we decide what to test, at which layer, and what to intentionally skip.

---

## Testing pyramid

The project uses a three-layer testing pyramid. Each layer targets
different failure modes and has different cost/value trade-offs:

| Layer                  | Tool                 | Scope                         | When to use                                              |
| ---------------------- | -------------------- | ----------------------------- | -------------------------------------------------------- |
| **Unit / Integration** | Vitest + convex-test | Pure functions, backend logic | Business logic, validation, data transformations         |
| **E2E**                | Playwright           | Full user flows               | Auth guards, CRUD workflows, cross-page navigation, a11y |
| **Visual regression**  | Playwright + Docker  | Screenshot comparison         | UI appearance, responsive layouts, error/empty states    |

Coverage metrics (via `pnpm test:coverage`) reflect Vitest unit and
integration tests only. Overall test confidence is assessed across all
three layers combined — a file at "0% unit coverage" may be thoroughly
tested by E2E and visual regression specs.

---

## What we test and where

### Unit / integration tests (Vitest)

High value — test here when the code contains **meaningful logic** that
can fail independently of the UI:

| Area                             | What to test                                                    | Examples                                                               |
| -------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------- |
| **Convex queries**               | Aggregation, filtering, pagination, auth guards, user isolation | `monthlyData` category aggregation, `availableMonths` skip algorithm   |
| **Convex mutations**             | Side effects, cascading cleanup, ownership checks, idempotency  | `create`/`remove` with attachment + orphan cleanup                     |
| **Pure functions**               | Transforms, validation, formatting                              | `validateYearMonth`, `distinctMonthsFromDates`, `parseCurrencyToCents` |
| **Zod schemas**                  | Edge cases, cross-field refinements, transform pipelines        | Amount string→cents, category cross-field validation                   |
| **React components** (selective) | Components with non-trivial rendering logic                     | `FieldError` dedup, `RouteErrorComponent` fallback                     |

### E2E tests (Playwright)

Test here when the behavior **crosses component/route boundaries** or
requires **real auth and backend state**:

- Auth flows (sign-up, sign-in, forgot-password, route guards)
- Full CRUD lifecycles (create → edit → delete expense)
- Report generation and CSV/ZIP export
- Settings management (category/merchant rename, orphan cleanup)
- Attachment upload/download/preview
- Accessibility audits (axe-core WCAG 2.x)
- Page titles and meta tags

### Visual regression tests (Playwright + Docker)

> **Version coupling:** The Playwright Docker image tag in CI workflows
> (`test-visual.yml`, `update-screenshots.yml`) and `docker-compose.test.yml`
> must match the `@playwright/test` version in `package.json`.

Test here for **appearance correctness** that would be tedious to assert
programmatically:

- Page layouts at desktop and mobile breakpoints
- Form states (empty, filled, validation errors, loading)
- Dialog/popover/combobox open states
- Empty vs populated data states

---

## What we intentionally skip

Not all 0% unit coverage is a gap. These categories are deliberately
**not unit-tested** because the effort provides no meaningful value
beyond what other test layers already cover:

### Thin UI wrappers (`src/components/ui/`)

Files like `avatar.tsx`, `card.tsx`, `dialog.tsx`, `select.tsx`,
`separator.tsx`, `skeleton.tsx`, `table.tsx` etc. are styling wrappers
around Base UI or Radix primitives with **no custom logic**. Testing them
would only verify that React renders a `<div>` — the real value is in
visual regression tests that catch styling regressions.

**Exception:** `FieldError` in `field.tsx` has error deduplication logic
and is unit-tested.

### Declarative configuration files

| File                     | Why skip                                                                                |
| ------------------------ | --------------------------------------------------------------------------------------- |
| `convex/schema.ts`       | Schema definition with no runtime logic; implicitly validated by every integration test |
| `convex/crons.ts`        | Cron schedule registration; the cleanup functions it calls are tested individually      |
| `convex/http.ts`         | Two-line HTTP router setup                                                              |
| `convex/auth.config.ts`  | Static auth provider configuration                                                      |
| `convex/auth.ts`         | Declarative auth provider wiring (`convexAuth` + Password + Resend reset)               |
| `convex/uploadLimits.ts` | Two exported constants                                                                  |

### Route components (`src/routes/`)

Route files contain layout composition and `beforeLoad` guards that
require router context and auth state. These are integration concerns
thoroughly tested by:

- **E2E tests:** `auth-guards.spec.ts` verifies redirect behavior,
  `page-titles.spec.ts` verifies all routes render, all CRUD specs
  exercise authenticated routes
- **Visual regression tests:** `pages.test.ts`, `dashboard.test.ts`,
  `reports.test.ts` screenshot every route

### Barrel exports and re-exports

`src/components/expense-form/index.tsx` and `src/lib/schemas.ts` are
re-exports with no logic.

### Seed and migration scripts (`convex/seed.ts`)

Seed functions and backfill migrations are implicitly tested by every
E2E and visual regression test run (CI deploys, seeds, runs tests, then
cleans up). Dedicated unit tests would duplicate this coverage.

### External provider glue (`convex/ResendOTPPasswordReset.ts`)

OTP token generation and Resend API calls are tightly coupled to
external services. The auth flow is covered by E2E tests. Mocking the
fetch call provides minimal confidence.

---

## Known convex-test limitations

`convex-test` provides a faithful in-memory replica of the Convex
runtime, but one limitation affects how we structure storage tests:

- **`contentType` is not populated** on `_storage` system records.
  `ctx.storage.store(new Blob([…], { type: 'image/jpeg' }))` stores the
  file but the record only contains `sha256` and `size`. This only
  affects the metadata-validation branch in `confirmUpload` (unclaimed
  new files), which always sees `undefined` for `contentType`. Other
  `confirmUpload` branches — idempotent already-claimed uploads and
  legacy expense-attachment backfills — bypass re-validation and are
  tested normally. The content-type guard itself is tested via the pure
  `validateFileMetadata` helper with synthetic metadata.

Other capabilities that were previously assumed to be limited but are
confirmed to work correctly:

- `ctx.storage.delete()` — removes the file; `getUrl()` returns `null`
- `ctx.db.system.query('_storage')` — system table queries work
- `internalMutation` — invocable via `t.mutation(internal.xxx, {})`
- `vi.useFakeTimers()` + `vi.advanceTimersByTime()` — works for
  testing time-dependent logic like the 24 h TTL in
  `cleanupOrphanedUploads`

---

## Shared test helpers

Common test setup functions live in `convex/testHelpers.ts` to avoid
duplication and subtle drift across test files:

| Helper                   | Purpose                                                     |
| ------------------------ | ----------------------------------------------------------- |
| `setupAuthenticatedUser` | Insert a user + return a `withIdentity` accessor            |
| `setupCategory`          | Insert a user-owned category with optional name             |
| `insertExpense`          | Insert an expense with sensible defaults (overrides)        |
| `setupStorageFile`       | Store a blob in Convex storage                              |
| `setupUploadRecord`      | Insert an upload ownership record (overridable `createdAt`) |

Domain-specific helpers (e.g. `insertMerchant`, `insertLegacyCategory`)
stay in their respective test files.

---

## Guiding principles

1. **Test behavior, not implementation.** Assert on observable outcomes
   (return values, database state, error messages), not internal function
   calls.

2. **One test layer per behavior.** If an E2E test covers an auth guard
   redirect, don't duplicate it as a unit test of the `beforeLoad` hook.

3. **Convex backend tests are highest ROI.** Business-critical logic
   (data aggregation, ownership checks, cascading cleanup) runs
   server-side and is cheap to test with `convex-test`.

4. **Pure functions get unit tests.** Validation schemas, formatters, and
   transforms are fast to test and catch regressions early.

5. **UI components are tested visually.** Thin wrappers around design
   system primitives are best verified by screenshot comparison, not
   render assertions.

6. **Coverage numbers are a signal, not a target.** A file at 0% unit
   coverage that has 12 E2E test cases covering it is well-tested.
   Adding unit tests just to move the number provides no value.
