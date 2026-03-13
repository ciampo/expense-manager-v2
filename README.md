# Expense Manager

A modern expense management application for tracking work-related expenses, built with TanStack Start, Convex, and ShadCN UI.

## Features

- **Dashboard**: View all expenses in a sortable table with quick delete actions
- **Expense Management**: Add/edit expenses with category and merchant autocomplete
- **File Attachments**: Upload receipts and invoices (images, PDFs up to 10MB)
- **Reports**: Generate monthly CSV exports and download attachments as ZIP
- **Authentication**: Email/password auth with password reset flow
- **Real-time Updates**: Live data synchronization via Convex
- **Optimistic UI**: Instant feedback with automatic rollback on errors

## Tech Stack

- **Framework**: [TanStack Start](https://tanstack.com/start) (React meta-framework)
- **Database & Auth**: [Convex](https://convex.dev)
- **UI Components**: [ShadCN UI](https://ui.shadcn.com) (base-nova style, built on Base UI primitives)
- **Styling**: Tailwind CSS v4
- **Hosting**: Cloudflare Workers
- **Testing**: Vitest + Playwright + Visual Regression with Docker

## Getting Started

### Prerequisites

- Node.js >= 24.13.0
- pnpm >= 10.28.2
- Docker Desktop (for visual regression tests)

### Setup

> **Quick start:** Run `pnpm setup` for a guided interactive walkthrough — installs dependencies, sets up `.env.local`, and walks through steps 3–6 below. You still need to create the Convex project manually (step 2).

1. Clone the repository:

   ```bash
   git clone <repo-url>
   cd expense-manager-v2
   pnpm install
   ```

2. Create a Convex project:
   - Go to [Convex Dashboard](https://dashboard.convex.dev/)
   - Create a new project
   - Copy the **development** deployment URL (use the deployment switcher in the dashboard)

3. Set up environment variables:

   ```bash
   cp .env.example .env.local
   # Edit .env.local with your Convex URL
   ```

4. Start Convex development server (leave this running):

   ```bash
   npx convex dev
   ```

5. Open a **new terminal** and configure authentication keys (run once per deployment):

   ```bash
   npx @convex-dev/auth
   ```

   When prompted for the **site URL**, enter `http://localhost:3000`.
   This sets `JWT_PRIVATE_KEY` and `JWKS` on your Convex deployment.

6. Seed the predefined categories and run migrations (run once, same terminal as step 5):

   ```bash
   npx convex run seed:seedCategories
   pnpm migrate
   ```

7. Start the app (same terminal):
   ```bash
   pnpm dev
   ```

Open [http://localhost:3000](http://localhost:3000) to see the app.

> **Note:** The above covers the minimum for local development. For the complete setup — including password reset (email provider), Cloudflare deployment, E2E test infrastructure, and GitHub CI/CD secrets — see [`docs/SETUP.md`](docs/SETUP.md). For a full environment variables reference, see [`docs/ENVIRONMENT_VARIABLES.md`](docs/ENVIRONMENT_VARIABLES.md).

## Development

### Scripts

| Command                          | Description                                   |
| -------------------------------- | --------------------------------------------- |
| `pnpm setup`                     | Guided interactive local dev setup            |
| `pnpm setup:e2e`                 | Guided interactive E2E test project setup     |
| `pnpm dev`                       | Start development server                      |
| `pnpm dev:e2e`                   | Start dev server with E2E test config         |
| `pnpm build`                     | Build for production (includes typecheck)     |
| `pnpm preview`                   | Preview production build locally              |
| `pnpm deploy`                    | Build and deploy to Cloudflare Workers        |
| `pnpm migrate`                   | Run pending Convex migrations                 |
| `pnpm test`                      | Run all Vitest tests                          |
| `pnpm test:unit`                 | Run unit tests only                           |
| `pnpm test:e2e`                  | Run Playwright E2E tests                      |
| `pnpm test:e2e:seed`             | Seed test data to E2E Convex project          |
| `pnpm test:e2e:cleanup`          | Clean up E2E test data                        |
| `pnpm test:visual`               | Run visual regression tests locally           |
| `pnpm test:visual:update`        | Update visual regression baselines locally    |
| `pnpm test:visual:docker`        | Run visual regression tests in Docker         |
| `pnpm test:visual:docker:update` | Update visual regression baselines in Docker  |
| `pnpm lint`                      | Run ESLint                                    |
| `pnpm lint:fix`                  | Run ESLint with auto-fix                      |
| `pnpm format`                    | Format code with Prettier                     |
| `pnpm format:check`              | Check code formatting                         |
| `pnpm typecheck`                 | Run TypeScript type checking (`tsc --noEmit`) |
| `pnpm cf-typegen`                | Generate Cloudflare Worker types              |

### Project Structure

```
expense-manager-v2/
├── src/
│   ├── __tests__/           # Unit tests (Vitest)
│   ├── components/          # React components
│   │   └── ui/              # ShadCN UI components
│   ├── lib/                 # Utilities (format, schemas, etc.)
│   └── routes/              # TanStack Router routes
│       ├── _auth/           # Auth pages (sign-in, sign-up, etc.)
│       └── _authenticated/  # Protected pages
├── convex/                  # Convex backend
│   ├── schema.ts            # Database schema
│   ├── auth.ts              # Auth configuration
│   ├── auth.config.ts       # Auth provider configuration
│   ├── expenses.ts          # Expense CRUD + server-side validation
│   ├── categories.ts        # Category functions
│   ├── reports.ts           # Report functions
│   ├── storage.ts           # File storage + upload ownership tracking
│   ├── uploadLimits.ts      # Shared file upload constants (MAX_FILE_SIZE, MIME types)
│   ├── validation.ts        # Pure validation helpers (date, amount, etc.)
│   ├── zodSchemas.ts        # Zod schemas for form validation
│   ├── seed.ts              # Seed, cleanup, and migration functions
│   ├── crons.ts             # Scheduled jobs (orphan upload cleanup)
│   └── http.ts              # HTTP routes (auth callbacks)
├── scripts/                 # Setup and utility scripts
├── docs/                    # Detailed setup and reference docs
├── e2e/                     # Playwright E2E tests
├── tests/
│   └── visual/              # Visual regression tests
└── .github/
    └── workflows/           # GitHub Actions
```

## Testing

### Unit Tests

```bash
pnpm test:unit
```

Unit tests live in `src/__tests__/`. Shared Zod schema assertion helpers (`expectSuccess`, `expectFailure`, `getErrorMessages`) are in `src/__tests__/test-utils.ts`.

### E2E Tests

E2E tests run against the **production deployment** of a dedicated Convex test project (separate from your dev project). See [Convex deployments](#convex) below for background on the project/deployment model.

> **Quick setup:** Run `pnpm setup:e2e` for a guided interactive walkthrough of steps 3–7 below (creates `.env.e2e`, validates credentials, deploys, prompts for the production URL, configures auth, and seeds data).

1. Create a test Convex project in the [Convex Dashboard](https://dashboard.convex.dev/): `expense-manager-test`
2. Generate a deploy key: Dashboard → test project → Settings → Deploy Keys → Generate Deploy Key — select **production**
3. Set up `.env.e2e` with the deploy key (see `.env.e2e.example` for reference):
   ```env
   VITE_CONVEX_URL=https://placeholder-will-update-after-step-4.convex.cloud
   CONVEX_DEPLOY_KEY=prod:your-test-project-deploy-key
   ```
4. Deploy the schema (this creates the production deployment if it doesn't exist):
   ```bash
   export CONVEX_DEPLOY_KEY=$(grep -m1 '^CONVEX_DEPLOY_KEY=' .env.e2e | cut -d'=' -f2- | tr -d '\r')
   npx convex deploy
   ```
5. Copy the **production** deployment URL from the Convex Dashboard (shown after step 4) and update `VITE_CONVEX_URL` in `.env.e2e`
6. Configure auth keys for the test project's production deployment:
   ```bash
   npx @convex-dev/auth --prod
   ```
   When prompted for the **site URL**, enter `http://localhost:3000` (E2E tests run locally).
7. Seed test data: `pnpm test:e2e:seed`
8. Run tests:
   ```bash
   pnpm test:e2e
   ```

Test data (including auth users) is cleaned up automatically after each run via Playwright's `globalTeardown`.

For E2E test authoring conventions (locator strategy, selector patterns), see [`docs/BEST_PRACTICES.md`](docs/BEST_PRACTICES.md#e2e-tests).

### Visual Regression Tests

Visual tests run in Docker to ensure consistent screenshots. In CI, the `test-visual.yml` and `update-screenshots.yml` workflows automatically deploy the Convex backend, run `seed:postDeploy` migrations, seed test data, and clean up afterward — matching the E2E pattern.

```bash
# Run tests (in Docker for consistent screenshots)
pnpm test:visual:docker

# Update baselines after intentional UI changes
pnpm test:visual:docker:update
```

## Deployment

### Convex

#### Environment architecture

The project uses three **fully isolated** Convex environments. Each has its own database, auth keys, and backend functions — data never leaks between them:

| Environment    | Convex Project         | Deployment  | Backend deployed by                             | Frontend connects via                        |
| -------------- | ---------------------- | ----------- | ----------------------------------------------- | -------------------------------------------- |
| **Local dev**  | `expense-manager`      | development | `npx convex dev` (auto-syncs on file save)      | `.env.local` → `VITE_CONVEX_URL`             |
| **Production** | `expense-manager`      | production  | `deploy.yml` (on merge to `main`)               | GitHub secret `CONVEX_PROD_URL`              |
| **Test (E2E)** | `expense-manager-test` | production  | `test-e2e.yml` (on every PR and push to `main`) | `.env.e2e` / GitHub secret `CONVEX_TEST_URL` |

> **Why "production" for test?** Convex deploy keys only work with production deployments. The "production" label is Convex terminology for the non-interactive, CLI-accessible deployment — it doesn't mean live user-facing. The test project is a **completely separate Convex project** with its own database.

#### How CI workflows map to environments

No CI workflow ever writes to an environment it shouldn't:

| Workflow                 | Trigger                    | Convex environment touched             | What it does                                                                       |
| ------------------------ | -------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------- |
| `test-e2e.yml`           | PR, push to `main`         | **Test** project (deploy + seed + run) | Deploys backend, seeds data, runs E2E tests, cleans up after                       |
| `test-visual.yml`        | PR, push to `main`         | **Test** project (deploy + seed + run) | Deploys backend, seeds data, runs visual regression tests, cleans up               |
| `update-screenshots.yml` | Manual (workflow_dispatch) | **Test** project (deploy + seed + run) | Deploys backend, seeds data, updates visual baselines, commits, cleans up          |
| `preview.yml`            | PR open/sync/reopen/close  | **Dev** project (read-only via URL)    | Deploys frontend preview to CF Workers pointing to dev backend; cleans up on close |
| `deploy.yml`             | Push to `main` **only**    | **Production** project (deploy)        | Deploys Convex backend, then builds and deploys frontend to CF Workers             |
| Others                   | PR, push to `main`         | None                                   | Lint, typecheck, unit tests — no Convex interaction                                |

**Key guarantee:** Only merges to `main` trigger production deployment. PRs are tested entirely against the isolated test project.

#### Setting up auth keys

Each deployment that users sign in to requires JWT keys. Generate and set them with:

```bash
# Dev project → development deployment (used by local dev)
# Site URL when prompted: http://localhost:3000
npx @convex-dev/auth

# Dev project → production deployment (used by the live app)
# Site URL when prompted: https://your-production-domain.com
npx @convex-dev/auth --prod

# Test project → production deployment (used by E2E tests)
# Requires CONVEX_DEPLOY_KEY to be set — see E2E Tests section above
# Site URL when prompted: http://localhost:3000
npx @convex-dev/auth --prod
```

This sets the `JWT_PRIVATE_KEY` and `JWKS` environment variables on the respective deployment. You can verify them in the [Convex Dashboard](https://dashboard.convex.dev/) under **Settings > Environment Variables**.

> **Site URL:** The `npx @convex-dev/auth` command prompts for the site URL, which is the URL where users access the app. Use `http://localhost:3000` for development and test deployments, and your production domain (e.g., `https://your-app.workers.dev`) for the production deployment.

### Cloudflare Workers

1. Login to Cloudflare:

   ```bash
   pnpm dlx wrangler login
   ```

2. Deploy:
   ```bash
   pnpm deploy
   ```

### CI/CD

The project includes GitHub Actions workflows for:

- **Unit Tests**: Run on every push/PR
- **E2E Tests**: Run on every push/PR with test data seeding
- **Visual Regression**: Run on every push/PR in Docker
- **Lint**: Run ESLint and Prettier checks on every push/PR
- **Type Check**: Run TypeScript type checking on every push/PR
- **Deploy**: Auto-deploy Convex backend, run migrations, and deploy Cloudflare Workers on push to `main`
- **Preview**: Deploy preview on every PR (automatically cleaned up when the PR is closed)
- **Update Screenshots**: Manually triggered workflow to update and commit visual regression baselines

Configure these GitHub Actions secrets:

| Secret                   | Description                                                                  |
| ------------------------ | ---------------------------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`   | Cloudflare API token                                                         |
| `CLOUDFLARE_ACCOUNT_ID`  | Cloudflare account ID                                                        |
| `CONVEX_PROD_URL`        | `expense-manager` project → **production** deployment URL                    |
| `CONVEX_PROD_DEPLOY_KEY` | `expense-manager` project → **production** deploy key                        |
| `CONVEX_DEV_URL`         | `expense-manager` project → **development** deployment URL (for PR previews) |
| `CONVEX_TEST_URL`        | `expense-manager-test` project → **production** deployment URL               |
| `CONVEX_TEST_DEPLOY_KEY` | `expense-manager-test` project → **production** deploy key                   |

> **Note:** During local development, `npx convex dev` automatically syncs backend changes to the development deployment on every file save. The CI pipeline handles production deployment — you never need to run `npx convex deploy` manually.

### Migrations

Schema backfills (e.g., populating a new field for existing records) are managed by idempotent migration functions in `convex/seed.ts`, orchestrated by `seed:postDeploy`:

- **CI (automatic):** `deploy.yml`, `test-e2e.yml`, `test-visual.yml`, and `update-screenshots.yml` run `npx convex run seed:postDeploy --prod` after every `npx convex deploy`. No manual intervention needed.
- **Local dev (manual):** Run `pnpm migrate` after pulling changes that include schema migrations. This is included in `pnpm setup` for fresh setups.

Migrations are idempotent and safe to run multiple times. Those that can short-circuit (e.g., merchants backfill) include an O(1) precondition check; others scan existing rows but only patch those still needing updates. To add a new migration, create a handler function in `convex/seed.ts` and call it from `postDeploy`.

## Backend Security & Validation

### File Upload Ownership

File attachments go through a tracked ownership flow:

1. Client uploads file to Convex storage → receives a `storageId`
2. Client calls `confirmUpload({ storageId })` → records a `(storageId, userId)` mapping in the `uploads` table. Rejects if another user already claimed the file (via `uploads` or `expenses`)
3. `getUrl` grants access if the user owns the upload record (preview) or an expense referencing the file (saved data)
4. `expenses.create` / `expenses.update` verify the user owns the upload record before linking it to an expense
5. `deleteFile` verifies ownership via the expenses table before deleting

A daily cron job (`crons.ts`, 3:00 AM UTC) cleans up orphaned files in two passes:

- **Tracked orphans**: upload records older than 24 h with no matching expense (any user)
- **Untracked orphans**: storage files with no upload record and no expense reference (e.g. `confirmUpload` failed)

### Server-side Expense Validation

All expense mutations (`create`, `update`) validate fields server-side:

| Field      | Rules                                                                      |
| ---------- | -------------------------------------------------------------------------- |
| `date`     | Must be a valid `YYYY-MM-DD` calendar date (e.g. `2026-02-30` is rejected) |
| `amount`   | Must be a positive integer (EUR cents) — `Number.isInteger` check          |
| `merchant` | Required after trimming, max 200 characters                                |
| `comment`  | Optional, max 1000 characters after trimming; empty → stored as absent     |

### Authorization

- All expense and storage queries/mutations require authentication
- Expenses are scoped to the owning user (`userId`)
- Custom categories are only accessible to their creator; predefined categories are public
- `categories.get` returns `null` for another user's custom category

## Known Limitations

- **No SSR data prefetching**: All data is fetched client-side via Convex real-time subscriptions. TanStack Router `loader` functions are not used.
- **No dark mode toggle**: The app uses a light theme only.
- **Client-only file type validation**: Attachment MIME type checks happen only on the client. Convex does not support server-side MIME type validation on upload. File ownership is verified server-side (see [Backend Security](#backend-security--validation)).
- **Local timezone dates**: Dates are stored as `YYYY-MM-DD` strings using the user's local timezone. No server-side timezone normalization is performed.

## License

Private project - All rights reserved.
