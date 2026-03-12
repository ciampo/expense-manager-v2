# Environment Variables Reference

This document lists all environment variables used in the Expense Manager project and where they should be defined.

---

## Overview

| Variable                | Location                   | Purpose                                                       |
| ----------------------- | -------------------------- | ------------------------------------------------------------- |
| `VITE_CONVEX_URL`       | `.env.local`, `.env.e2e`   | Convex backend URL                                            |
| `CONVEX_DEPLOYMENT`     | `.env.local`               | Auto-set by `npx convex dev` — do not edit manually           |
| `CONVEX_DEPLOY_KEY`     | `.env.e2e`, GitHub Secrets | Deploy/run functions on Convex projects (test and production) |
| `CLOUDFLARE_API_TOKEN`  | GitHub Secrets             | Deploy to Cloudflare Workers                                  |
| `CLOUDFLARE_ACCOUNT_ID` | GitHub Secrets             | Cloudflare account identifier                                 |
| `CONVEX_SITE_URL`       | Convex Environment         | Base site URL for auth (auto-set by `npx @convex-dev/auth`)   |
| `JWT_PRIVATE_KEY`       | Convex Environment         | Private key for signing JWTs (auto-set by auth setup)         |
| `JWKS`                  | Convex Environment         | JSON Web Key Set for verifying JWTs (auto-set by auth setup)  |
| `AUTH_RESEND_KEY`       | Convex Environment         | Resend API key for password reset emails                      |
| `AUTH_RESEND_FROM`      | Convex Environment         | Sender address for password reset emails (optional)           |

---

## Local Environment Files

### `.env.local` (Development)

Used during local development. Points to the **development deployment** of the `expense-manager` project.

```env
VITE_CONVEX_URL=https://your-dev-project.convex.cloud
CONVEX_DEPLOYMENT=dev:your-project  # Auto-populated by `npx convex dev`
```

| Variable            | Required | Description                                                   |
| ------------------- | -------- | ------------------------------------------------------------- |
| `VITE_CONVEX_URL`   | Yes      | `expense-manager` project → **development** deployment URL    |
| `CONVEX_DEPLOYMENT` | Auto     | Set automatically by `npx convex dev` -- do not edit manually |

**How to get it:**

1. Go to [Convex Dashboard](https://dashboard.convex.dev/)
2. Select the `expense-manager` project
3. Use the deployment switcher to select **Development**
4. Copy the deployment URL

---

### `.env.e2e` (E2E Tests)

Used when running E2E tests (loaded via `--mode e2e`). Both values target the **production deployment** of the `expense-manager-test` project.

```env
VITE_CONVEX_URL=https://your-test-project.convex.cloud
CONVEX_DEPLOY_KEY=prod:your-test-project-deploy-key
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

| Secret Name              | Description                                                           | Source               |
| ------------------------ | --------------------------------------------------------------------- | -------------------- |
| `CLOUDFLARE_API_TOKEN`   | API token for Cloudflare Workers deployment                           | Cloudflare Dashboard |
| `CLOUDFLARE_ACCOUNT_ID`  | Your Cloudflare account identifier                                    | Cloudflare Dashboard |
| `CONVEX_PROD_URL`        | `expense-manager` → **production** deployment URL                     | Convex Dashboard     |
| `CONVEX_PROD_DEPLOY_KEY` | `expense-manager` → **production** deploy key (for CI backend deploy) | Convex Dashboard     |
| `CONVEX_DEV_URL`         | `expense-manager` → **development** deployment URL (for PR previews)  | Convex Dashboard     |
| `CONVEX_TEST_URL`        | `expense-manager-test` → **production** deployment URL                | Convex Dashboard     |
| `CONVEX_TEST_DEPLOY_KEY` | `expense-manager-test` → **production** deploy key                    | Convex Dashboard     |

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

| Variable          | Required | Description                                                                                         |
| ----------------- | -------- | --------------------------------------------------------------------------------------------------- |
| `CONVEX_SITE_URL` | Yes      | Base site URL for auth callbacks (set by `npx @convex-dev/auth`; must match the site URL you enter) |
| `JWT_PRIVATE_KEY` | Yes      | Private key for signing JWTs (set by `npx @convex-dev/auth`)                                        |
| `JWKS`            | Yes      | JSON Web Key Set for verifying JWTs (set by `npx @convex-dev/auth`)                                 |

> **Note:** These are set automatically by running `npx @convex-dev/auth` (or `npx @convex-dev/auth --prod` for production). Do not edit them manually. `CONVEX_SITE_URL` is read by `convex/auth.config.ts` to configure the auth provider domain.

### Application Variables

| Variable           | Required for              | Description                                                                                                                              |
| ------------------ | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `AUTH_RESEND_KEY`  | Password reset (optional) | Resend API key for password reset emails                                                                                                 |
| `AUTH_RESEND_FROM` | Production (optional)     | Sender address for password reset emails (e.g., `App <noreply@yourdomain.com>`). Falls back to `Expense Manager <onboarding@resend.dev>` |

The app runs without `AUTH_RESEND_KEY`, but the forgot-password flow will not work.
`AUTH_RESEND_FROM` is optional — omit it during development to use Resend's sandbox sender.

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

---

## CI/CD Environment Variables

These are automatically set by GitHub Actions or defined in workflow files.

### Automatically Available

| Variable       | Set By         | Description                         |
| -------------- | -------------- | ----------------------------------- |
| `CI`           | GitHub Actions | Indicates running in CI environment |
| `GITHUB_TOKEN` | GitHub Actions | Token for GitHub API operations     |

### Set in Workflows

| Variable                | Workflow File            | Value                                   |
| ----------------------- | ------------------------ | --------------------------------------- |
| `VITE_CONVEX_URL`       | `deploy.yml`             | `${{ secrets.CONVEX_PROD_URL }}`        |
| `CONVEX_DEPLOY_KEY`     | `deploy.yml`             | `${{ secrets.CONVEX_PROD_DEPLOY_KEY }}` |
| `CLOUDFLARE_API_TOKEN`  | `deploy.yml`             | `${{ secrets.CLOUDFLARE_API_TOKEN }}`   |
| `CLOUDFLARE_ACCOUNT_ID` | `deploy.yml`             | `${{ secrets.CLOUDFLARE_ACCOUNT_ID }}`  |
| `VITE_CONVEX_URL`       | `preview.yml`            | `${{ secrets.CONVEX_DEV_URL }}`         |
| `CLOUDFLARE_API_TOKEN`  | `preview.yml`            | `${{ secrets.CLOUDFLARE_API_TOKEN }}`   |
| `CLOUDFLARE_ACCOUNT_ID` | `preview.yml`            | `${{ secrets.CLOUDFLARE_ACCOUNT_ID }}`  |
| `VITE_CONVEX_URL`       | `test-e2e.yml`           | `${{ secrets.CONVEX_TEST_URL }}`        |
| `CONVEX_DEPLOY_KEY`     | `test-e2e.yml`           | `${{ secrets.CONVEX_TEST_DEPLOY_KEY }}` |
| `VITE_CONVEX_URL`       | `test-visual.yml`        | `${{ secrets.CONVEX_TEST_URL }}`        |
| `CONVEX_DEPLOY_KEY`     | `test-visual.yml`        | `${{ secrets.CONVEX_TEST_DEPLOY_KEY }}` |
| `VITE_CONVEX_URL`       | `update-screenshots.yml` | `${{ secrets.CONVEX_TEST_URL }}`        |
| `CONVEX_DEPLOY_KEY`     | `update-screenshots.yml` | `${{ secrets.CONVEX_TEST_DEPLOY_KEY }}` |

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
CONVEX_PROD_URL            # For production deployments (deploy.yml)
CONVEX_PROD_DEPLOY_KEY     # For Convex backend deploy (deploy.yml)
CONVEX_DEV_URL             # For PR preview deployments (preview.yml)
CONVEX_TEST_URL            # For E2E tests
CONVEX_TEST_DEPLOY_KEY     # For E2E tests
```

### Convex Email (Optional)

```bash
# Set in Convex environment
npx convex env set AUTH_RESEND_KEY re_xxxxx

# Production only — verified domain sender
npx convex env set AUTH_RESEND_FROM 'Your App <noreply@yourdomain.com>'
```
