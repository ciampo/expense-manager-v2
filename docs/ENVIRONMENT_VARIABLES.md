# Environment Variables Reference

This document lists all environment variables used in the Expense Manager project and where they should be defined.

## Naming Conventions

Variable names follow the convention of their runtime:

- **`VITE_*`** — Exposed to client-side code by Vite (e.g. `VITE_TURNSTILE_SITE_KEY`). Only variables with this prefix are available in the browser via `import.meta.env`.
- **`CONVEX_*`** — Consumed by the Convex CLI (e.g. `CONVEX_DEPLOY_KEY`, `CONVEX_DEPLOYMENT`).
- **No prefix** — Server-side only, set on the Convex dashboard (e.g. `TURNSTILE_SECRET_KEY`, `SITE_URL`).

> **GitHub Secrets use different names** than the env vars they produce.
> Secrets encode _which deployment_ they target (e.g. `CONVEX_PROD_URL`,
> `CONVEX_TEST_DEPLOY_KEY`, `TURNSTILE_SITE_KEY`), and workflows map them
> to the generic names tools expect (e.g. `VITE_CONVEX_URL`,
> `CONVEX_DEPLOY_KEY`, `VITE_TURNSTILE_SITE_KEY`). See the
> [CI/CD section](#cicd-environment-variables) for the full mapping.
>
> **Common pitfall:** The GH Secret is `TURNSTILE_SITE_KEY` (no `VITE_`
> prefix), but locally and in CI the env var must be
> `VITE_TURNSTILE_SITE_KEY` — Vite ignores variables without the prefix.

---

## Overview

| Variable                  | Location                             | Purpose                                                       |
| ------------------------- | ------------------------------------ | ------------------------------------------------------------- |
| `VITE_CONVEX_URL`         | `.env.local`, `.env.e2e`             | Convex backend URL                                            |
| `VITE_TURNSTILE_SITE_KEY` | `.env.local`, `.env.e2e`, GH Secrets | Cloudflare Turnstile site key for auth form bot protection    |
| `CONVEX_DEPLOYMENT`       | `.env.local`                         | Auto-set by `npx convex dev` — do not edit manually           |
| `CONVEX_DEPLOY_KEY`       | `.env.e2e`, GitHub Secrets           | Deploy/run functions on Convex projects (test and production) |
| `CLOUDFLARE_API_TOKEN`    | GitHub Secrets                       | Deploy to Cloudflare Workers                                  |
| `CLOUDFLARE_ACCOUNT_ID`   | GitHub Secrets                       | Cloudflare account identifier                                 |
| `TURNSTILE_SECRET_KEY`    | Convex Environment (prod + test)     | Cloudflare Turnstile secret key — must pair with site key     |
| `E2E_CLEANUP_ALLOWED`     | Convex Environment                   | Guardrail — must be `true` for `seed:cleanup` to run          |
| `SITE_URL`                | Convex Environment                   | Your app's URL for auth callback links (e.g. OTP emails)      |
| `JWT_PRIVATE_KEY`         | Convex Environment                   | Private key for signing JWTs (auto-set by auth setup)         |
| `JWKS`                    | Convex Environment                   | JSON Web Key Set for verifying JWTs (auto-set by auth setup)  |
| `AUTH_RESEND_KEY`         | Convex Environment                   | Resend API key for password reset emails                      |
| `AUTH_RESEND_FROM`        | Convex Environment                   | Sender address for password reset emails (optional)           |
| `ALLOWED_EMAILS`          | Convex Environment                   | Comma-separated allowlist of emails/domain wildcards          |
| `REGISTRATION_ENABLED`    | Convex Environment                   | Set to `false` to block all new sign-ups                      |

---

## Local Environment Files

### `.env.local` (Development)

Used during local development. Points to the **development deployment** of the `expense-manager` project.

```env
VITE_CONVEX_URL=https://your-dev-project.convex.cloud
CONVEX_DEPLOYMENT=dev:your-project  # Auto-populated by `npx convex dev`

# Optional — Cloudflare Turnstile bot protection (omit for local dev)
# VITE_TURNSTILE_SITE_KEY=0x...
```

| Variable                  | Required | Description                                                                   |
| ------------------------- | -------- | ----------------------------------------------------------------------------- |
| `VITE_CONVEX_URL`         | Yes      | `expense-manager` project → **development** deployment URL                    |
| `CONVEX_DEPLOYMENT`       | Auto     | Set automatically by `npx convex dev` -- do not edit manually                 |
| `VITE_TURNSTILE_SITE_KEY` | No       | Cloudflare Turnstile site key — when unset, the widget is omitted (see below) |

**How to get `VITE_CONVEX_URL`:**

1. Go to [Convex Dashboard](https://dashboard.convex.dev/)
2. Select the `expense-manager` project
3. Use the deployment switcher to select **Development**
4. Copy the deployment URL

For `VITE_TURNSTILE_SITE_KEY`, see [Setting Up Cloudflare Turnstile](#setting-up-cloudflare-turnstile) below.

---

### `.env.e2e` (E2E Tests)

Used when running E2E tests (loaded via `--mode e2e`). Both values target the **production deployment** of the `expense-manager-test` project.

```env
VITE_CONVEX_URL=https://your-test-project.convex.cloud
CONVEX_DEPLOY_KEY=prod:your-test-project-deploy-key

# Cloudflare Turnstile always-pass test key — avoids blocking test automation
# See: https://developers.cloudflare.com/turnstile/troubleshooting/testing/
VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA
```

| Variable            | Required | Description                                                                                             |
| ------------------- | -------- | ------------------------------------------------------------------------------------------------------- |
| `VITE_CONVEX_URL`   | Yes      | `expense-manager-test` project → **production** deployment URL                                          |
| `CONVEX_DEPLOY_KEY` | Yes      | `expense-manager-test` project → **production** deploy key (used by seed, cleanup, and deploy commands) |

**How to get the values:**

1. Go to [Convex Dashboard](https://dashboard.convex.dev/)
2. Select the `expense-manager-test` project
3. Use the deployment switcher to select **Production**, then copy the deployment URL for `VITE_CONVEX_URL`
4. Go to Settings → Deploy Keys → Generate Deploy Key (select **production**) for `CONVEX_DEPLOY_KEY`

> **Why production?** Deploy keys only work with production deployments. The E2E seed, cleanup, and `npx convex deploy` commands all require a deploy key for non-interactive access. The app under test (`VITE_CONVEX_URL`) must point to the same deployment that these commands target.

---

## GitHub Actions Secrets

These secrets are configured in your GitHub repository settings.

**Location:** Repository → Settings → Secrets and variables → Actions

### Required Secrets

| Secret Name              | Maps to in workflows      | Description                                                           | Source               |
| ------------------------ | ------------------------- | --------------------------------------------------------------------- | -------------------- |
| `CLOUDFLARE_API_TOKEN`   | _(action input)_          | API token for Cloudflare Workers deployment                           | Cloudflare Dashboard |
| `CLOUDFLARE_ACCOUNT_ID`  | _(action input)_          | Cloudflare account identifier                                         | Cloudflare Dashboard |
| `TURNSTILE_SITE_KEY`     | `VITE_TURNSTILE_SITE_KEY` | Cloudflare Turnstile site key for auth form bot protection            | Cloudflare Dashboard |
| `CONVEX_PROD_URL`        | `VITE_CONVEX_URL`         | `expense-manager` → **production** deployment URL                     | Convex Dashboard     |
| `CONVEX_PROD_DEPLOY_KEY` | `CONVEX_DEPLOY_KEY`       | `expense-manager` → **production** deploy key (for CI backend deploy) | Convex Dashboard     |
| `CONVEX_DEV_URL`         | `VITE_CONVEX_URL`         | `expense-manager` → **development** deployment URL (for PR previews)  | Convex Dashboard     |
| `CONVEX_TEST_URL`        | `VITE_CONVEX_URL`         | `expense-manager-test` → **production** deployment URL                | Convex Dashboard     |
| `CONVEX_TEST_DEPLOY_KEY` | `CONVEX_DEPLOY_KEY`       | `expense-manager-test` → **production** deploy key                    | Convex Dashboard     |

### How to Get Each Value

#### `CLOUDFLARE_API_TOKEN`

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Profile → API Tokens → Create Token
3. Use template "Edit Cloudflare Workers"
4. Copy the generated token

#### `CLOUDFLARE_ACCOUNT_ID`

1. Go to Cloudflare Dashboard
2. Workers & Pages (left sidebar)
3. Copy "Account ID" from right sidebar

#### `TURNSTILE_SITE_KEY`

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Turnstile (left sidebar) → Add Widget
3. Enter a name (e.g., "Expense Manager") and add your domain(s)
4. Widget Mode: **Managed** (invisible for most users, challenges only when suspicious)
5. Click "Create" and copy the **Site Key**

> The matching **Secret Key** must be set as `TURNSTILE_SECRET_KEY` in the Convex environment (see below).

#### `CONVEX_PROD_URL`

1. Go to [Convex Dashboard](https://dashboard.convex.dev/)
2. Select the `expense-manager` project
3. Use the deployment switcher to select **Production**
4. Copy the deployment URL (e.g., `https://xxx-xxx-xxx.convex.cloud`)

#### `CONVEX_PROD_DEPLOY_KEY`

1. Go to [Convex Dashboard](https://dashboard.convex.dev/)
2. Select the `expense-manager` project
3. Settings → Deploy Keys → Generate Deploy Key — select **production**
4. Copy the key (starts with `prod:`, only shown once)

#### `CONVEX_DEV_URL`

1. Go to [Convex Dashboard](https://dashboard.convex.dev/)
2. Select the `expense-manager` project
3. Use the deployment switcher to select **Development**
4. Copy the deployment URL (e.g., `https://xxx-xxx-xxx.convex.cloud`)

> This is the same URL as `VITE_CONVEX_URL` in `.env.local`. It's used by the PR preview workflow so preview deployments connect to the development backend.

#### `CONVEX_TEST_URL`

1. Go to [Convex Dashboard](https://dashboard.convex.dev/)
2. Select the `expense-manager-test` project
3. Use the deployment switcher to select **Production**
4. Copy the deployment URL (e.g., `https://xxx-xxx-xxx.convex.cloud`)

> This is the same URL as `VITE_CONVEX_URL` in `.env.e2e`.

#### `CONVEX_TEST_DEPLOY_KEY`

1. Go to [Convex Dashboard](https://dashboard.convex.dev/)
2. Select the `expense-manager-test` project
3. Settings → Deploy Keys → Generate Deploy Key — select **production**
4. Copy the key (starts with `prod:`, only shown once)

> This is the same key as `CONVEX_DEPLOY_KEY` in `.env.e2e`.

---

## Convex Environment Variables

These are stored in Convex and available to your server functions.

**Location:** Convex Dashboard → Project → Settings → Environment Variables

Or via CLI:

```bash
npx convex env set VARIABLE_NAME value
```

### Auth Variables (Auto-configured)

| Variable          | Required | Description                                                                               |
| ----------------- | -------- | ----------------------------------------------------------------------------------------- |
| `SITE_URL`        | Yes      | Your app's URL (e.g. `http://localhost:3000`), used for auth callback links in OTP emails |
| `JWT_PRIVATE_KEY` | Yes      | Private key for signing JWTs (set by `npx @convex-dev/auth`)                              |
| `JWKS`            | Yes      | JSON Web Key Set for verifying JWTs (set by `npx @convex-dev/auth`)                       |

> **Note:** These are set automatically by running `npx @convex-dev/auth` (or `npx @convex-dev/auth --prod` for production). Do not edit them manually.
>
> **`SITE_URL` vs `CONVEX_SITE_URL`:** These are different variables.
> `SITE_URL` is a user-set env var — your app's URL (e.g. `http://localhost:3000` for dev, `https://yourapp.com` for prod), used by `@convex-dev/auth` to generate callback links in OTP emails.
> `CONVEX_SITE_URL` is auto-provided by Convex — the deployment's HTTP actions endpoint (e.g. `https://brilliant-otter-473.convex.site`). It is available as `process.env.CONVEX_SITE_URL` in server code without being set manually.
> `convex/auth.config.ts` reads `process.env.CONVEX_SITE_URL` (the Convex HTTP endpoint), not `SITE_URL`.

### Application Variables

| Variable               | Required for              | Description                                                                                                                                         |
| ---------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TURNSTILE_SECRET_KEY` | Prod + test only          | Cloudflare Turnstile secret key — must be paired with the client site key; do not set on dev without also setting `VITE_TURNSTILE_SITE_KEY` locally |
| `E2E_CLEANUP_ALLOWED`  | E2E test deployment       | Must be `true` on test deployments — prevents destructive `seed:cleanup` from running against production                                            |
| `AUTH_RESEND_KEY`      | Password reset (optional) | Resend API key for password reset emails                                                                                                            |
| `AUTH_RESEND_FROM`     | Production (optional)     | Sender address for password reset emails (e.g., `App <noreply@yourdomain.com>`). Falls back to `Expense Manager <onboarding@resend.dev>`            |

`E2E_CLEANUP_ALLOWED` is a safety guardrail: the `seed:cleanup` mutation refuses to run unless this variable is `true` on the targeted Convex deployment. Set it only on the `expense-manager-test` project — **never** on production. It is set automatically by `pnpm setup:e2e` and by the CI workflows.

The app runs without `AUTH_RESEND_KEY`, but the forgot-password flow will not work.
`AUTH_RESEND_FROM` is optional — omit it during development to use Resend's sandbox sender.

### Registration Controls

| Variable               | Required | Description                                                                                                                                                                  |
| ---------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ALLOWED_EMAILS`       | No       | Comma-separated list of allowed email addresses or domain wildcards (e.g. `alice@example.com,*@mycompany.org`). When empty or unset, all emails are accepted (no filtering). |
| `REGISTRATION_ENABLED` | No       | Set to `false` to instantly block all new sign-ups. Any other value (or unset) means registration is open (subject to the allowlist).                                        |

`ALLOWED_EMAILS` entries are case-insensitive. Entries starting with `*@` match the exact domain (e.g. `*@mycompany.org` allows `alice@mycompany.org` but not `alice@sub.mycompany.org`); all others are exact email matches.

`REGISTRATION_ENABLED=false` acts as a hard kill switch — it blocks all new registrations regardless of the allowlist. Existing users can still sign in. To re-enable, set the variable to any other value or remove it.

A `beforeSessionCreation` callback also validates the allowlist on every sign-in (defense-in-depth). If a previously allowed email is removed from `ALLOWED_EMAILS`, that user will be blocked on their next sign-in attempt.

#### Setting Registration Controls

```bash
# Development — allow specific emails
npx convex env set ALLOWED_EMAILS "your-email@example.com"

# Multiple emails and domain wildcards
npx convex env set ALLOWED_EMAILS "alice@example.com,bob@example.com,*@mycompany.org"

# Production — requires CONVEX_DEPLOY_KEY
CONVEX_DEPLOY_KEY=<prod-deploy-key> npx convex env set ALLOWED_EMAILS "your-email@example.com"

# Emergency: disable all new registrations
CONVEX_DEPLOY_KEY=<prod-deploy-key> npx convex env set REGISTRATION_ENABLED false

# Re-enable registrations
CONVEX_DEPLOY_KEY=<prod-deploy-key> npx convex env set REGISTRATION_ENABLED true
```

### Setting Up Email Provider

#### Using Resend

```bash
npx convex env set AUTH_RESEND_KEY re_xxxxx

# Production — requires CONVEX_DEPLOY_KEY to target the production deployment:
CONVEX_DEPLOY_KEY=<prod-deploy-key> npx convex env set AUTH_RESEND_KEY re_xxxxx
CONVEX_DEPLOY_KEY=<prod-deploy-key> npx convex env set AUTH_RESEND_FROM 'Your App <noreply@yourdomain.com>'
```

**How to get it:**

1. Sign up at [Resend](https://resend.com/) (free tier is sufficient for development)
2. Go to API Keys → Create API Key
3. Copy the key (starts with `re_`)

> **Note:** Set `AUTH_RESEND_KEY` in every Convex deployment where password reset should work (development, production, test projects). `AUTH_RESEND_FROM` is only needed in production — during development the default `onboarding@resend.dev` sandbox sender is used. See [SETUP.md](./SETUP.md#18-configure-email-provider-password-reset) for details.

### Setting Up Cloudflare Turnstile

Turnstile provides bot protection on auth forms (sign-in, sign-up, forgot-password). It requires two keys: a **site key** (client-side) and a **secret key** (server-side).

#### 1. Create a Turnstile Widget

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) → Turnstile (left sidebar)
2. Click "Add widget"
3. Enter a name (e.g., "Expense Manager") and add your domain(s)
4. Widget Mode: **Managed** (invisible for most users, challenges only when suspicious)
5. Click "Create" and copy both the **Site Key** and **Secret Key**

#### 2. Set the Secret Key on Convex Deployments

```bash
# Production (required for bot protection)
CONVEX_DEPLOY_KEY=<prod-deploy-key> npx convex env set TURNSTILE_SECRET_KEY "0x..."
```

> **Do not set `TURNSTILE_SECRET_KEY` on the development deployment** unless you also set `VITE_TURNSTILE_SITE_KEY` in `.env.local`. If the server key is set without the site key, auth flows will fail because the server requires a token that no widget produces. Leave both unset on dev for frictionless local development.

#### 3. Set the Site Key

- **Local:** Add `VITE_TURNSTILE_SITE_KEY=0x...` to `.env.local`
- **GitHub Actions:** Add a `TURNSTILE_SITE_KEY` repository secret (Settings → Secrets → Actions)
- **E2E tests:** Use Cloudflare's always-pass test key (`1x00000000000000000000AA`) in `.env.e2e` and set the always-pass secret key (`1x0000000000000000000000000000000AA`) on the Convex test deployment

> **Graceful degradation:** Server-side validation runs only when `TURNSTILE_SECRET_KEY` is set on the Convex deployment; the client widget renders only when `VITE_TURNSTILE_SITE_KEY` is set. For each environment, either configure both keys or leave both unset. If `TURNSTILE_SECRET_KEY` is set but the site key is not, the widget won't render but the server will still require a token and auth flows will fail. In local development you can skip Turnstile entirely by leaving `TURNSTILE_SECRET_KEY` unset on the Convex dev deployment.

---

## CI/CD Environment Variables

These are automatically set by GitHub Actions or defined in workflow files.

### Automatically Available

| Variable       | Set By         | Description                         |
| -------------- | -------------- | ----------------------------------- |
| `CI`           | GitHub Actions | Indicates running in CI environment |
| `GITHUB_TOKEN` | GitHub Actions | Token for GitHub API operations     |

### Set as Environment Variables in Workflows

| Variable                  | Workflow File            | Value                                         |
| ------------------------- | ------------------------ | --------------------------------------------- |
| `VITE_CONVEX_URL`         | `deploy.yml`             | `${{ secrets.CONVEX_PROD_URL }}`              |
| `VITE_TURNSTILE_SITE_KEY` | `deploy.yml`             | `${{ secrets.TURNSTILE_SITE_KEY }}`           |
| `CONVEX_DEPLOY_KEY`       | `deploy.yml`             | `${{ secrets.CONVEX_PROD_DEPLOY_KEY }}`       |
| `VITE_CONVEX_URL`         | `preview.yml`            | `${{ secrets.CONVEX_DEV_URL }}`               |
| `VITE_TURNSTILE_SITE_KEY` | `preview.yml`            | `${{ secrets.TURNSTILE_SITE_KEY }}`           |
| `VITE_CONVEX_URL`         | `test-integration.yml`   | `${{ secrets.CONVEX_TEST_URL }}`              |
| `VITE_TURNSTILE_SITE_KEY` | `test-integration.yml`   | `1x00000000000000000000AA` (always-pass test) |
| `CONVEX_DEPLOY_KEY`       | `test-integration.yml`   | `${{ secrets.CONVEX_TEST_DEPLOY_KEY }}`       |
| `VITE_CONVEX_URL`         | `update-screenshots.yml` | `${{ secrets.CONVEX_TEST_URL }}`              |
| `VITE_TURNSTILE_SITE_KEY` | `update-screenshots.yml` | `1x00000000000000000000AA` (always-pass test) |
| `CONVEX_DEPLOY_KEY`       | `update-screenshots.yml` | `${{ secrets.CONVEX_TEST_DEPLOY_KEY }}`       |

### Secrets Passed as Action Inputs

These GitHub Secrets are passed directly as inputs to third-party actions (not exported as environment variables in the job):

| Secret                  | Workflow File | Passed As                     | Action / Step                   |
| ----------------------- | ------------- | ----------------------------- | ------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | `deploy.yml`  | `apiToken` input              | `cloudflare/wrangler-action@v3` |
| `CLOUDFLARE_ACCOUNT_ID` | `deploy.yml`  | `accountId` input             | `cloudflare/wrangler-action@v3` |
| `TURNSTILE_SITE_KEY`    | `deploy.yml`  | `VITE_TURNSTILE_SITE_KEY` env | `pnpm build`                    |
| `CLOUDFLARE_API_TOKEN`  | `preview.yml` | `apiToken` input              | `cloudflare/wrangler-action@v3` |
| `CLOUDFLARE_ACCOUNT_ID` | `preview.yml` | `accountId` input             | `cloudflare/wrangler-action@v3` |
| `TURNSTILE_SITE_KEY`    | `preview.yml` | `VITE_TURNSTILE_SITE_KEY` env | `pnpm build`                    |

---

## Environment File Templates

### `.env.local` Template

Based on `.env.example` (committed to git):

```env
# === Local Development ===

# Convex development deployment URL
# Get from: Convex Dashboard → your project → Settings → URL
VITE_CONVEX_URL=https://your-project.convex.cloud

# Convex deployment identifier (auto-populated by `npx convex dev`)
CONVEX_DEPLOYMENT=dev:your-project

# === Cloudflare Turnstile (optional) ===

# Site key for Cloudflare Turnstile bot protection on auth forms.
# When unset, the widget is omitted and server-side validation is skipped.
# VITE_TURNSTILE_SITE_KEY=0x...

# === Production Deployment (optional, for manual deploys) ===

# Production deploy key for Convex backend deployment
# Get from: Convex Dashboard → your project → Settings → Deploy Keys
# CONVEX_DEPLOY_KEY=prod:your-project-deploy-key
```

### `.env.e2e` Template

Based on `.env.e2e.example` (committed to git):

```env
# E2E Test Convex deployment URL (production deployment of test project)
VITE_CONVEX_URL=https://your-test-project.convex.cloud

# Production deploy key for the test Convex project
# Get from: Convex Dashboard → test project → Settings → Deploy Keys
CONVEX_DEPLOY_KEY=prod:your-test-project-deploy-key

# Cloudflare Turnstile always-pass test key — avoids blocking test automation
# See: https://developers.cloudflare.com/turnstile/troubleshooting/testing/
VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA
```

---

## Security Notes

### Files to NEVER Commit

These files contain secrets and are in `.gitignore`:

- `.env`
- `.env.local`
- `.env.e2e`
- Any `*.local` files

> **Note:** If you create additional env files (e.g., `.env.staging`, `.env.production`), add them to `.gitignore` before use.

### Safe to Commit

- `.env.example` (contains placeholder values only)
- `.env.e2e.example` (contains placeholder values only)

### Rotating Secrets

If a secret is compromised:

1. **Cloudflare API Token:** Revoke in Cloudflare Dashboard → API Tokens → Delete, then create new
2. **Convex Deploy Key:** Delete in Convex Dashboard → Settings → Deploy Keys, then create new
3. **Update GitHub Secrets:** Repository → Settings → Secrets → Update each affected secret

---

## Quick Reference

### Local Development

```bash
# Required files
.env.local          → VITE_CONVEX_URL (development)

# Start development
npx convex dev      # Terminal 1
pnpm dev            # Terminal 2
```

### E2E Testing (Local)

```bash
# Required files
.env.e2e            → VITE_CONVEX_URL (test)
                    → CONVEX_DEPLOY_KEY (test project deploy key)

# Run E2E tests (cleanup runs automatically via Playwright globalTeardown)
pnpm test:e2e
```

### CI/CD

```bash
# Required GitHub Secrets
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
TURNSTILE_SITE_KEY         # Cloudflare Turnstile site key for auth forms
CONVEX_PROD_URL            # For production deployments (deploy.yml)
CONVEX_PROD_DEPLOY_KEY     # For Convex backend deploy (deploy.yml)
CONVEX_DEV_URL             # For PR preview deployments (preview.yml)
CONVEX_TEST_URL            # For E2E tests
CONVEX_TEST_DEPLOY_KEY     # For E2E tests
```

### Audit All Environments

```bash
# Check local files + GitHub Secrets + all reachable Convex deployments
pnpm check:env

# Also check the production Convex deployment (key from GH Secrets)
CONVEX_PROD_DEPLOY_KEY='prod:...' pnpm check:env

# Only check local env files (no network calls)
pnpm check:env --skip-remote
```

### Convex Email (Optional)

```bash
# Set in Convex environment
npx convex env set AUTH_RESEND_KEY re_xxxxx

# Production only — verified domain sender
npx convex env set AUTH_RESEND_FROM 'Your App <noreply@yourdomain.com>'
```

---

## Auditing Environment Variables

Run `pnpm check:env` to verify that every environment has exactly the expected variables — no missing required vars, no unexpected leftovers.

```bash
pnpm check:env
```

### What it checks

| Environment    | How                              | Required                                                                  | Optional                                                                                                |
| -------------- | -------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `.env.local`   | File parse                       | `VITE_CONVEX_URL`, `CONVEX_DEPLOYMENT`                                    | `VITE_TURNSTILE_SITE_KEY`, `CONVEX_DEPLOY_KEY`                                                          |
| `.env.e2e`     | File parse                       | `VITE_CONVEX_URL`, `CONVEX_DEPLOY_KEY`, `VITE_TURNSTILE_SITE_KEY`         | —                                                                                                       |
| GitHub Secrets | `gh secret list`                 | All 8 secrets listed in [GitHub Actions Secrets](#github-actions-secrets) | —                                                                                                       |
| Convex dev     | `npx convex env list`            | `SITE_URL`, `JWT_PRIVATE_KEY`, `JWKS`                                     | `AUTH_RESEND_KEY`, `AUTH_RESEND_FROM`, `TURNSTILE_SECRET_KEY`, `ALLOWED_EMAILS`, `REGISTRATION_ENABLED` |
| Convex test    | Deploy key from `.env.e2e`       | Same as dev + `E2E_CLEANUP_ALLOWED`                                       | Same as dev minus `AUTH_RESEND_FROM`                                                                    |
| Convex prod    | `CONVEX_PROD_DEPLOY_KEY` env var | Same as dev                                                               | Same as dev                                                                                             |

### Options

- **`--skip-remote`** — Only check local env files (`.env.local`, `.env.e2e`). Useful offline or in CI where remote credentials aren't available.
- **`CONVEX_PROD_DEPLOY_KEY='prod:...' pnpm check:env`** — Also audit the production Convex deployment. The production deploy key is normally only in GitHub Secrets; pass it as an env var to include that check. **Quote the value** — deploy keys contain `|` which the shell interprets as a pipe.

### Graceful degradation

The script skips any environment it can't reach and prints a `SKIPPED` warning:

- Missing `.env.local` or `.env.e2e` file
- `gh` CLI not installed or not authenticated
- Missing deploy key for Convex test or production

### Turnstile key pairing cross-check

The script also verifies that Turnstile keys are consistently paired: if a Convex deployment has `TURNSTILE_SECRET_KEY`, the corresponding client environment must also have the site key, and vice versa. A mismatch is reported as an error (server key without site key causes auth failures).

### Exit code

- `0` — all checked environments pass
- `1` — at least one environment has missing required vars, unexpected vars, or key pairing mismatches
