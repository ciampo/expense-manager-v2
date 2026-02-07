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

### 1.1 Create Production Project

1. Go to [Convex Dashboard](https://dashboard.convex.dev/)
2. Click "New Project"
3. Name it: `expense-manager`
4. Copy the deployment URL (format: `https://xxx-xxx-xxx.convex.cloud`)
5. Save it to `.env.local` in the project root:
   ```
   VITE_CONVEX_URL=https://your-project.convex.cloud
   ```

### 1.2 Create Test Project (for E2E Tests)

1. In Convex Dashboard, click "New Project"
2. Name it: `expense-manager-test`
3. Copy the deployment URL
4. Save it to `.env.test` in the project root:
   ```
   VITE_CONVEX_URL=https://your-test-project.convex.cloud
   ```

### 1.3 Generate Deploy Key for Test Project

1. In Convex Dashboard, select the **test** project
2. Go to Settings → Deploy Keys
3. Click "Generate Deploy Key"
4. Copy and save the key securely (it's only shown once)
5. This key will be added to GitHub secrets later

### 1.4 Initialize Convex Locally

```bash
# Link to production project and generate types
npx convex dev
```

When prompted:
- Log in to your Convex account
- Select the `expense-manager` project

This will:
- Generate `convex/_generated/` types
- Sync your schema to Convex
- Start the Convex development server

### 1.5 Configure Authentication Keys

Each Convex deployment requires JWT keys for `@convex-dev/auth`. Generate and set them with:

```bash
# For the development deployment (linked via npx convex dev)
npx @convex-dev/auth
```

This sets the `JWT_PRIVATE_KEY` and `JWKS` environment variables on your Convex deployment. You can verify them in the [Convex Dashboard](https://dashboard.convex.dev/) under **Settings > Environment Variables**.

> **Note:** For the production deployment, run `npx @convex-dev/auth --prod` instead.

### 1.6 Deploy Schema to Test Project

The test project needs the same schema deployed:

```bash
# Set the test project's deploy key
export CONVEX_DEPLOY_KEY=your_test_project_deploy_key

# Deploy schema to test project
npx convex deploy
```

### 1.7 Seed Initial Data

Seed the predefined categories using the existing seed scripts:

```bash
# Seed data in the currently linked Convex project
npx convex run seed:seedCategories

# For the test project (using deploy key)
CONVEX_DEPLOY_KEY=your_test_key npx convex run seed:e2e --prod
```

> **Note:** The `seed:e2e` function seeds categories and prepares the database for E2E tests. Use `npx convex run seed:cleanup --prod` to clean up test data afterwards.

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
| `CONVEX_PROD_URL` | Production Convex deployment URL (used by `deploy.yml`) |
| `CONVEX_DEV_URL` | Development Convex deployment URL (used by `preview.yml` for PR previews) |
| `CONVEX_TEST_URL` | Test Convex project URL (`https://xxx.convex.cloud`) |
| `CONVEX_TEST_DEPLOY_KEY` | Test Convex project deploy key |

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

- [ ] `.env.local` contains production Convex URL
- [ ] `.env.test` contains test Convex URL
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
