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

---

## 8. Email allowlist and registration kill switch

New sign-ups are restricted to emails listed in `ALLOWED_EMAILS` (Convex
env var). An empty list means "allow all" to keep development frictionless.
`REGISTRATION_ENABLED=false` acts as a hard kill switch that blocks all new
registrations instantly without redeploying.

**Why:** The app is publicly deployed and any email can sign up by default.
Since this is a personal/small-team tool, unbounded sign-ups would amplify
Convex and Resend costs. An allowlist is the simplest, most effective
access control for this use case.

**Implementation:** A custom `createOrUpdateUser` callback in
`convex/auth.ts` checks both controls before creating a new user.
A `beforeSessionCreation` callback provides defense-in-depth — if an email
is removed from the allowlist, creation of any new sessions for that user
is blocked on subsequent sign-in attempts, while already-issued sessions
continue until they expire. Error messages on the client remain generic to
avoid revealing which emails are allowed.

**Trade-off:** No self-service invite flow — new users must be manually
added to the env var. Acceptable for a personal app; at scale, replace
with a DB-backed invite table with admin UI.

---

## 9. Application-level rate limiting

Auth endpoints and file uploads are rate-limited through two
complementary layers:

**Layer 1 — `@convex-dev/auth` built-in failed-attempt limiter.** The
library tracks failed credential attempts (wrong password, wrong OTP) and
blocks further attempts after the configured threshold. We explicitly set
`signIn.maxFailedAttempsPerHour: 10` in `convexAuth()` — this is the
primary defense against brute-force password guessing from
unauthenticated users. On successful auth the counter resets.

**Layer 2 — `@convex-dev/rate-limiter` application-level limits.** A
Convex component that enforces additional per-account limits:

- **Sign-in** (5/min, token bucket, `beforeSessionCreation`): caps
  successful session creation. This fires only after credentials are
  accepted, so it guards against credential-stuffing with valid/leaked
  passwords — not failed-password brute-force (which Layer 1 handles).
- **Sign-up** (3/hour, fixed window, `createOrUpdateUser`): prevents mass
  account creation.
- **Password reset** (3/hour, fixed window, client-side preflight
  mutation): reduces OTP email spam from the official UI. A custom client
  can bypass this preflight — true server-side enforcement relies on
  Layer 1's failed-attempt cap.
- **File upload** (10/min, token bucket, `generateUploadUrl`): prevents
  storage abuse by authenticated users.

**Why email-keyed, not IP-keyed:** Convex mutations/queries don't have
access to client IP addresses. Only HTTP actions receive IP info, but the
auth flow is handled by `@convex-dev/auth` internally. Email-keyed limits
still prevent per-account abuse. IP-level protection is handled by
Cloudflare Turnstile at the edge.

**Password-reset rate limiting:** `@convex-dev/auth` sends the OTP email
inside its `signIn` action before any mutation callback runs, so the
password-reset rate limit is enforced via a client-side preflight
mutation (`consumePasswordResetRateLimit`) that the official UI calls
before initiating the reset. A custom client could bypass this check.
True server-side enforcement of reset attempts relies on Layer 1's
failed-attempt cap. Note: because the preflight mutation is
unauthenticated, an attacker could invoke it with a victim's email to
exhaust their 3/hour budget — the official UI would then show "too many
attempts" even though the actual reset flow (via `signIn`) still works.

**At scale:** Add IP-based rate limiting by wrapping auth HTTP routes with
a custom HTTP action that extracts the IP, or use Cloudflare WAF
rate-limiting rules at the edge.

---

## 10. Cloudflare Turnstile for bot protection on auth forms

All public-facing auth forms (sign-in, sign-up, forgot-password) include
a Cloudflare Turnstile widget. Tokens are validated server-side via the
siteverify API before processing the auth request.

**Why Turnstile over reCAPTCHA/hCaptcha:** The app is already on
Cloudflare. Turnstile is free, privacy-focused (no tracking cookies),
invisible to most users, and does not require a Google account. It
provides IP-level bot detection that complements email-keyed rate
limiting.

**Server-side integration:** The `@convex-dev/auth` Password provider's
internal `authorize` function is wrapped to validate the Turnstile token
before the auth flow runs. This accesses the provider's internal
`options.authorize` — an implementation detail, but it avoids
reimplementing the entire Password provider logic.

**Graceful degradation:** Server-side validation is gated by
`TURNSTILE_SECRET_KEY`; the client widget is gated by
`VITE_TURNSTILE_SITE_KEY`. Both keys must be set together or both left
unset — if only the server key is set, auth flows fail because no widget
produces a token. For local development, leave both unset (do not set
`TURNSTILE_SECRET_KEY` on the dev Convex deployment) so no Turnstile
keys are required for local work.

---

## 11. Security headers via Cloudflare Worker

Standard security headers (HSTS, X-Content-Type-Options, X-Frame-Options,
Referrer-Policy, Permissions-Policy) are added to all Worker responses via
a custom server entry point (`src/server.ts`).

The Content Security Policy (CSP) is set separately via TanStack Start
global middleware (`src/start.ts`), which generates a cryptographic nonce
per request and passes it to the router's `ssr.nonce` option. TanStack
Start automatically injects the nonce into all inline `<script>` and
`<style>` tags during SSR, allowing the CSP to use a strict nonce-based
policy instead of `'unsafe-inline'`.

**Why:** Defense-in-depth. While React's JSX escaping prevents most XSS,
security headers provide additional layers (clickjacking protection, MIME
sniffing prevention, referrer control). The CSP is deployed in **enforcing
mode** (`Content-Security-Policy`) with `'strict-dynamic'` and a
per-request nonce in `script-src`, which materially mitigates XSS by
ensuring only server-stamped scripts execute. The `'unsafe-inline'`
directive has been removed from `script-src` (it was only needed during the
initial Report-Only monitoring period before nonce support was wired in).
`style-src` retains `'unsafe-inline'` because component-level inline
`style` attributes cannot use nonces and pose minimal risk.

**CSP violation reporting:** A same-origin `/__csp-report` endpoint
receives violation reports (via `report-to` and legacy `report-uri`
directives). The Worker logs reports with `console.log`, making them
visible in Cloudflare's real-time logs (`wrangler tail`) with no
external infrastructure required. Reporting remains active under
enforcement to surface any unexpected violations.

**HSTS preload:** The `Strict-Transport-Security` header includes the
`preload` directive, signaling eligibility for the
[HSTS preload list](https://hstspreload.org). Submission is a separate
manual step after verifying the header is served consistently.

**Trade-off:** Maintaining a strict CSP requires ongoing work — any new
third-party script or resource needs to be explicitly trusted (or loaded
dynamically by a nonced script, which `'strict-dynamic'` allows). The
nonce must be generated per request, which prevents full-page caching or
prerendering. This is acceptable for this app since every page load is
user-specific (authenticated) anyway.
