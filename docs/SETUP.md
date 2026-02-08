# Manual Setup Guide

This guide covers all the manual configuration steps required to set up the Expense Manager project.

## Prerequisites

- Node.js >= 24.13.0
- pnpm >= 10.28.2 (enable via `corepack enable`)
- Docker Desktop (for visual regression tests)
- GitHub account
- Cloudflare account
- Convex account

---

## 1. Convex Setup

> **Convex project vs deployment:** Each Convex *project* has two *deployments*: **development** (used by `npx convex dev`, interactive) and **production** (used by `npx convex deploy` and deploy keys, non-interactive). Each deployment has its own URL and database. See the [Convex docs](https://docs.convex.dev/production) for details.

### 1.1 Create Development Project

1. Go to [Convex Dashboard](https://dashboard.convex.dev/)
2. Click "New Project"
3. Name it: `expense-manager`
4. Copy the **development** deployment URL (format: `https://xxx-xxx-xxx.convex.cloud`)
5. Save it to `.env.local` in the project root:
   ```
   VITE_CONVEX_URL=https://your-project.convex.cloud
   ```

### 1.2 Create Test Project (for E2E Tests)

1. In Convex Dashboard, click "New Project"
2. Name it: `expense-manager-test`

> At this point the test project only has a development deployment. Step 1.6 (`npx convex deploy`) will create the production deployment.

### 1.3 Generate Deploy Key for Test Project

Deploy keys provide non-interactive access to a project's **production** deployment. They are required for CLI commands like `convex deploy`, `convex run ... --prod`, and are used by E2E test seed/cleanup scripts.

1. In Convex Dashboard, select the **test** project
2. Go to Settings → Deploy Keys
3. Click "Generate Deploy Key"
4. Copy and save the key securely (it's only shown once)
5. This key will be added to GitHub secrets later **and** to `.env.test`

Save the deploy key to `.env.test` in the project root (the production deployment URL will be added after step 1.6):
```env
VITE_CONVEX_URL=https://placeholder-will-update-after-deploy.convex.cloud
CONVEX_DEPLOY_KEY=your_test_project_deploy_key
```

> **Note:** `CONVEX_DEPLOY_KEY` in `.env.test` is used by the Convex CLI for deploy, seed, and cleanup commands, and by Playwright's `globalTeardown` to automatically clean up test data (including auth users) after each E2E run.

### 1.4 Initialize Convex Locally

```bash
# Link to development project and generate types
npx convex dev
```

When prompted:
- Log in to your Convex account
- Select the `expense-manager` project

This will:
- Generate `convex/_generated/` types
- Sync your schema to Convex
- Start the Convex development server

> **Note:** `npx convex dev` is a long-running watcher. Leave it running and open a **new terminal** for the following steps.

### 1.5 Configure Authentication Keys

Each Convex deployment that users sign in to requires JWT keys for `@convex-dev/auth`. In a **separate terminal** (while `convex dev` is still running), generate and set them with:

```bash
# Dev project → development deployment (used by local dev)
npx @convex-dev/auth

# Dev project → production deployment (used by the live app)
npx @convex-dev/auth --prod
```

When prompted for the **site URL**, enter:
- **Development deployment:** `http://localhost:3000`
- **Production deployment:** your production domain (e.g., `https://your-app.workers.dev`)

This sets the `JWT_PRIVATE_KEY` and `JWKS` environment variables on the respective deployment. You can verify them in the [Convex Dashboard](https://dashboard.convex.dev/) under **Settings > Environment Variables**.

> **Note:** The test project's production deployment also needs auth keys — this is covered in step 1.6 below, after the production deployment has been created.

### 1.6 Deploy Schema and Auth Keys to Test Project

The test project needs the same schema deployed to its **production** deployment. This step creates the production deployment if it doesn't exist yet.

```bash
# Load the deploy key from .env.test
export $(grep CONVEX_DEPLOY_KEY .env.test | xargs)

# Deploy schema — creates the production deployment on first run
npx convex deploy

# Configure auth keys for the test project's production deployment
# Site URL when prompted: http://localhost:3000 (E2E tests run locally)
npx @convex-dev/auth --prod
```

After deploying, go to the Convex Dashboard → test project and copy the **production** deployment URL. Update `VITE_CONVEX_URL` in `.env.test`:
```env
VITE_CONVEX_URL=https://your-test-project-prod-url.convex.cloud
CONVEX_DEPLOY_KEY=your_test_project_deploy_key
```

> **Important:** All `convex` commands in this terminal session will target the test project's production deployment as long as `CONVEX_DEPLOY_KEY` is set. To switch back to the development project, run `unset CONVEX_DEPLOY_KEY`.

### 1.7 Seed Initial Data

Seed the predefined categories using the existing seed scripts:

```bash
# Seed the development project (currently linked via npx convex dev)
npx convex run seed:seedCategories

# Seed the test project (CONVEX_DEPLOY_KEY must be set — see step 1.6)
pnpm test:e2e:seed
```

> **Note:** Test data (including auth users created during E2E runs) is cleaned up automatically by Playwright's `globalTeardown` after each `pnpm test:e2e` run. You can also clean up manually with `pnpm test:e2e:cleanup` (requires `CONVEX_DEPLOY_KEY` to be set).

### 1.8 Configure Email Provider (Optional)

For password reset emails in production:

#### Using Resend (Recommended)

1. Sign up at [Resend](https://resend.com/)
2. Create an API key
3. Add to Convex environment:
   ```bash
   npx convex env set AUTH_RESEND_KEY=re_xxxxx
   ```
4. Verify your domain in Resend for production emails

#### Development Mode

In development, Convex Auth logs emails to the console instead of sending them. No additional setup required.

---

## 2. Cloudflare Setup

### 2.1 Create API Token

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Click your profile icon → "My Profile"
3. Go to "API Tokens" in the left sidebar
4. Click "Create Token"
5. Use the template: **"Edit Cloudflare Workers"**
6. Configure permissions:
   - Account: Cloudflare Workers Scripts (Edit)
   - Zone: Workers Routes (Edit)
7. Click "Continue to summary" → "Create Token"
8. **Copy and save the token** (it's only shown once)

### 2.2 Get Account ID

1. Go to Cloudflare Dashboard
2. Click "Workers & Pages" in the left sidebar
3. Find "Account ID" in the right sidebar
4. Copy it

### 2.3 Authenticate Wrangler Locally

```bash
pnpm dlx wrangler login
```

This opens a browser to authenticate your local machine with Cloudflare.

---

## 3. GitHub Repository Setup

### 3.1 Create Repository

1. Go to [GitHub](https://github.com/new)
2. Create a new repository: `expense-manager`
3. Don't initialize with README (we already have code)

### 3.2 Push Code to GitHub

```bash
git remote add origin https://github.com/YOUR_USERNAME/expense-manager.git
git branch -M main
git push -u origin main
```

### 3.3 Add Repository Secrets

Go to: Repository → Settings → Secrets and variables → Actions

Click "New repository secret" for each:

| Secret Name | Description |
|-------------|-------------|
| `CLOUDFLARE_API_TOKEN` | Your Cloudflare API token |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID |
| `CONVEX_PROD_URL` | `expense-manager` project → **production** deployment URL (used by `deploy.yml`) |
| `CONVEX_DEV_URL` | `expense-manager` project → **development** deployment URL (used by `preview.yml` for PR previews) |
| `CONVEX_TEST_URL` | `expense-manager-test` project → **production** deployment URL (same as `VITE_CONVEX_URL` in `.env.test`) |
| `CONVEX_TEST_DEPLOY_KEY` | `expense-manager-test` project → **production** deploy key (same as `CONVEX_DEPLOY_KEY` in `.env.test`) |

### 3.4 Configure Branch Protection Rules

1. Go to: Repository → Settings → Branches
2. Click "Add branch protection rule"
3. Set branch name pattern: `main`
4. Enable these options:
   - ✅ Require a pull request before merging
   - ✅ Require status checks to pass before merging
     - Search and add: `Unit Tests`, `E2E Tests`, `Visual Regression Tests`
   - ✅ Require branches to be up to date before merging
   - ✅ (Optional) Require approvals: 1
5. Click "Create"

---

## 4. Docker Setup (for Visual Regression Tests)

### 4.1 Install Docker Desktop

1. Download [Docker Desktop](https://www.docker.com/products/docker-desktop/)
2. Install and start Docker Desktop
3. Verify installation:
   ```bash
   docker --version
   docker compose version
   ```

### 4.2 First Run

The first visual test run will pull the Playwright Docker image (~1GB):

```bash
pnpm test:visual:docker
```

---

## 5. Verification Checklist

### Before Development

- [ ] `.env.local` contains development Convex URL
- [ ] `.env.test` contains test Convex URL and `CONVEX_DEPLOY_KEY`
- [ ] `npx convex dev` runs without errors
- [ ] Categories seeded: `npx convex run seed:seedCategories` (or `pnpm test:e2e:seed` for test project)
- [ ] Wrangler authenticated: `pnpm dlx wrangler whoami`

### Before CI/CD

- [ ] GitHub repository created
- [ ] All 6 GitHub secrets added
- [ ] Branch protection rules configured
- [ ] Docker Desktop running

### Test Everything

```bash
# Start Convex (Terminal 1)
npx convex dev

# Start app (Terminal 2)
pnpm dev

# Run unit tests
pnpm test:unit

# Run visual tests (requires Docker)
pnpm test:visual:docker
```

---

## 6. Common Issues

### "Cannot find module './\_generated/server'"

Run `npx convex dev` to generate types.

### "Unauthorized" when deploying to Cloudflare

Run `pnpm dlx wrangler login` to re-authenticate.

### Visual tests fail with different screenshots

Ensure you're running tests in Docker for consistent results:
```bash
pnpm test:visual:docker
```

### E2E tests fail in CI

Check that:
1. `CONVEX_TEST_URL` secret is correct
2. `CONVEX_TEST_DEPLOY_KEY` secret is correct
3. Schema is deployed to test project
