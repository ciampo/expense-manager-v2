# Environment Variables Reference

This document lists all environment variables used in the Expense Manager project and where they should be defined.

---

## Overview

| Variable | Location | Purpose |
|----------|----------|---------|
| `VITE_CONVEX_URL` | `.env.local`, `.env.test` | Convex backend URL |
| `CONVEX_DEPLOY_KEY` | `.env.test`, GitHub Secrets | Deploy/run functions on test Convex project |
| `CLOUDFLARE_API_TOKEN` | GitHub Secrets | Deploy to Cloudflare Workers |
| `CLOUDFLARE_ACCOUNT_ID` | GitHub Secrets | Cloudflare account identifier |
| `AUTH_RESEND_KEY` | Convex Environment | Email provider for auth |

---

## Local Environment Files

### `.env.local` (Development Convex)

Used during local development. Points to your **development** Convex project.

```env
VITE_CONVEX_URL=https://your-dev-project.convex.cloud
CONVEX_DEPLOYMENT=dev:your-project  # Auto-populated by `npx convex dev`
```

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_CONVEX_URL` | Yes | Development Convex deployment URL |
| `CONVEX_DEPLOYMENT` | Auto | Set automatically by `npx convex dev` -- do not edit manually |

**How to get it:**
1. Go to [Convex Dashboard](https://dashboard.convex.dev/)
2. Select your development project
3. Copy the "Deployment URL" from the project overview

---

### `.env.test` (Test Convex)

Used when running E2E tests locally (`pnpm dev:e2e`). Points to your **test** Convex project and provides the deploy key for seeding/cleanup.

```env
VITE_CONVEX_URL=https://your-test-project.convex.cloud
CONVEX_DEPLOY_KEY=your_test_project_deploy_key
```

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_CONVEX_URL` | Yes | Test Convex deployment URL |
| `CONVEX_DEPLOY_KEY` | Yes | Production deploy key for the test Convex project (used by seed, cleanup, and deploy commands) |

**How to get the values:**
1. Go to [Convex Dashboard](https://dashboard.convex.dev/)
2. Select your test project (`expense-manager-test`)
3. Copy the "Deployment URL" for `VITE_CONVEX_URL`
4. Go to Settings → Deploy Keys → Generate Deploy Key for `CONVEX_DEPLOY_KEY`

---

## GitHub Actions Secrets

These secrets are configured in your GitHub repository settings.

**Location:** Repository → Settings → Secrets and variables → Actions

### Required Secrets

| Secret Name | Description | Source |
|-------------|-------------|--------|
| `CLOUDFLARE_API_TOKEN` | API token for Cloudflare Workers deployment | Cloudflare Dashboard |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account identifier | Cloudflare Dashboard |
| `CONVEX_PROD_URL` | Production Convex deployment URL | Convex Dashboard |
| `CONVEX_DEV_URL` | Development Convex deployment URL (for PR previews) | Convex Dashboard |
| `CONVEX_TEST_URL` | Test Convex project deployment URL | Convex Dashboard |
| `CONVEX_TEST_DEPLOY_KEY` | Deploy key for test Convex project | Convex Dashboard |

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
2. Select your **production** project
3. Copy the deployment URL (e.g., `https://xxx-xxx-xxx.convex.cloud`)

#### `CONVEX_DEV_URL`
1. Go to [Convex Dashboard](https://dashboard.convex.dev/)
2. Select your **development** project
3. Copy the deployment URL (e.g., `https://xxx-xxx-xxx.convex.cloud`)

#### `CONVEX_TEST_URL`
1. Go to [Convex Dashboard](https://dashboard.convex.dev/)
2. Select the **test** project
3. Copy the deployment URL (e.g., `https://xxx-xxx-xxx.convex.cloud`)

#### `CONVEX_TEST_DEPLOY_KEY`
1. Go to Convex Dashboard
2. Select the **test** project
3. Settings → Deploy Keys → Generate Deploy Key
4. Copy the key (only shown once)

---

## Convex Environment Variables

These are stored in Convex and available to your server functions.

**Location:** Convex Dashboard → Project → Settings → Environment Variables

Or via CLI:
```bash
npx convex env set VARIABLE_NAME=value
```

### Auth Variables (Auto-configured)

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_PRIVATE_KEY` | Yes | Private key for signing JWTs (set by `npx @convex-dev/auth`) |
| `JWKS` | Yes | JSON Web Key Set for verifying JWTs (set by `npx @convex-dev/auth`) |

> **Note:** These are set automatically by running `npx @convex-dev/auth` (or `npx @convex-dev/auth --prod` for production). Do not edit them manually.

### Optional Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `AUTH_RESEND_KEY` | No* | Resend API key for sending auth emails |

*Required only if you want to send real emails (password reset, verification).

### Setting Up Email Provider

#### Using Resend
```bash
npx convex env set AUTH_RESEND_KEY=re_xxxxx
```

**How to get it:**
1. Sign up at [Resend](https://resend.com/)
2. Go to API Keys → Create API Key
3. Copy the key

---

## CI/CD Environment Variables

These are automatically set by GitHub Actions or defined in workflow files.

### Automatically Available

| Variable | Set By | Description |
|----------|--------|-------------|
| `CI` | GitHub Actions | Indicates running in CI environment |
| `GITHUB_TOKEN` | GitHub Actions | Token for GitHub API operations |

### Set in Workflows

| Variable | Workflow File | Value |
|----------|---------------|-------|
| `VITE_CONVEX_URL` | `deploy.yml` | `${{ secrets.CONVEX_PROD_URL }}` |
| `VITE_CONVEX_URL` | `preview.yml` | `${{ secrets.CONVEX_DEV_URL }}` |
| `VITE_CONVEX_URL` | `test-e2e.yml` | `${{ secrets.CONVEX_TEST_URL }}` |
| `CONVEX_DEPLOY_KEY` | `test-e2e.yml` | `${{ secrets.CONVEX_TEST_DEPLOY_KEY }}` |

---

## Environment File Templates

### `.env.local` Template
```env
# Convex Development URL
# Get from: https://dashboard.convex.dev/ → Your Project → Deployment URL
VITE_CONVEX_URL=https://your-project.convex.cloud

# Auto-populated by `npx convex dev` -- do not edit manually
# CONVEX_DEPLOYMENT=dev:your-project
```

### `.env.test` Template
```env
# Convex Test URL (for E2E tests)
# Get from: https://dashboard.convex.dev/ → Test Project → Deployment URL
VITE_CONVEX_URL=https://your-test-project.convex.cloud

# Convex production deploy key for the test project (used by E2E test seed/cleanup)
# Get from: Convex Dashboard → Test Project → Settings → Deploy Keys
CONVEX_DEPLOY_KEY=your_test_project_deploy_key
```

### `.env.example` (Committed to Git)
```env
# Convex deployment URL
# Get from: https://dashboard.convex.dev/
VITE_CONVEX_URL=https://your-project.convex.cloud
```

---

## Security Notes

### Files to NEVER Commit

These files contain secrets and are in `.gitignore`:

- `.env`
- `.env.local`
- `.env.test`
- Any `*.local` files

> **Note:** If you create additional env files (e.g., `.env.staging`, `.env.production`), add them to `.gitignore` before use.

### Safe to Commit

- `.env.example` (contains placeholder values only)

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
.env.test           → VITE_CONVEX_URL (test)
                    → CONVEX_DEPLOY_KEY (test project deploy key)

# Run E2E tests (cleanup runs automatically via Playwright globalTeardown)
pnpm test:e2e
```

### CI/CD
```bash
# Required GitHub Secrets
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
CONVEX_PROD_URL         # For production deployments (deploy.yml)
CONVEX_DEV_URL          # For PR preview deployments (preview.yml)
CONVEX_TEST_URL         # For E2E tests
CONVEX_TEST_DEPLOY_KEY  # For E2E tests
```

### Convex Email (Optional)
```bash
# Set in Convex environment
npx convex env set AUTH_RESEND_KEY=re_xxxxx
```
