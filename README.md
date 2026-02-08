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

1. Clone the repository:
   ```bash
   git clone <repo-url>
   cd expense-manager-v2
   pnpm install
   ```

2. Create a Convex project:
   - Go to [Convex Dashboard](https://dashboard.convex.dev/)
   - Create a new project
   - Copy the deployment URL

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
   This sets `JWT_PRIVATE_KEY` and `JWKS` on your Convex deployment.

6. Seed the predefined categories (run once, same terminal as step 5):
   ```bash
   npx convex run seed:seedCategories
   ```

7. Start the app (same terminal):
   ```bash
   pnpm dev
   ```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## Development

### Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server |
| `pnpm build` | Build for production |
| `pnpm test` | Run all tests |
| `pnpm test:unit` | Run unit tests |
| `pnpm test:e2e` | Run E2E tests |
| `pnpm test:visual:docker` | Run visual regression tests in Docker |
| `pnpm test:visual:docker:update` | Update visual regression baselines |
| `pnpm deploy` | Deploy to Cloudflare Workers |

### Project Structure

```
expense-manager-v2/
├── src/
│   ├── components/          # React components
│   │   └── ui/              # ShadCN UI components
│   ├── lib/                 # Utilities (format, etc.)
│   └── routes/              # TanStack Router routes
│       ├── _auth/           # Auth pages (sign-in, sign-up, etc.)
│       └── _authenticated/  # Protected pages
├── convex/                  # Convex backend
│   ├── schema.ts            # Database schema
│   ├── auth.ts              # Auth configuration
│   ├── expenses.ts          # Expense functions
│   ├── categories.ts        # Category functions
│   ├── reports.ts           # Report functions
│   └── storage.ts           # File storage functions
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

### E2E Tests

E2E tests run against the **production deployment** of a dedicated Convex test project (separate from your dev project). See [Convex deployments](#convex) below for background on the project/deployment model.

1. Create a test Convex project in the [Convex Dashboard](https://dashboard.convex.dev/): `expense-manager-test`
2. Generate a production deploy key: Dashboard → test project → Settings → Deploy Keys
3. Add both values to `.env.test`:
   ```env
   VITE_CONVEX_URL=https://your-test-project.convex.cloud
   CONVEX_DEPLOY_KEY=your_test_project_deploy_key
   ```
   > `VITE_CONVEX_URL` must be the **production deployment** URL (shown after step 4). `CONVEX_DEPLOY_KEY` is the production deploy key from step 2.
4. Deploy the schema (this creates the production deployment if it doesn't exist):
   ```bash
   export $(grep CONVEX_DEPLOY_KEY .env.test | xargs)
   npx convex deploy
   ```
5. Configure auth keys for the test project's production deployment:
   ```bash
   npx @convex-dev/auth --prod
   ```
6. Seed test data: `pnpm test:e2e:seed`
7. Run tests:
   ```bash
   pnpm test:e2e
   ```

Test data (including auth users) is cleaned up automatically after each run via Playwright's `globalTeardown`.

### Visual Regression Tests

Visual tests run in Docker to ensure consistent screenshots:

```bash
# Run tests (in Docker for consistent screenshots)
pnpm test:visual:docker

# Update baselines after intentional UI changes
pnpm test:visual:docker:update
```

## Deployment

### Convex

The project uses two Convex **projects**, each with its own development and production **deployments**:

| Convex Project | Deployment Used | Purpose | URL configured via |
|----------------|----------------|---------|-------------------|
| `expense-manager` | development | Local dev (`pnpm dev`) | `.env.local` → `VITE_CONVEX_URL` |
| `expense-manager` | production | Live app (deployed from `main`) | GitHub secret `CONVEX_PROD_URL` |
| `expense-manager-test` | production | E2E and visual regression tests | `.env.test` → `VITE_CONVEX_URL`, GitHub secret `CONVEX_TEST_URL` |

> **Why production deployments?** Deploy keys (needed for non-interactive CLI commands like seed, cleanup, and `npx convex deploy`) only work with production deployments. The "production" label is Convex terminology — it doesn't mean it's your live app, just the stable, CLI-accessible deployment.

#### Setting up auth keys

Each deployment that users sign in to requires JWT keys. Generate and set them with:

```bash
# Dev project → development deployment (used by local dev)
npx @convex-dev/auth

# Dev project → production deployment (used by the live app)
npx @convex-dev/auth --prod

# Test project → production deployment (used by E2E tests)
# Requires CONVEX_DEPLOY_KEY to be set — see E2E Tests section above
npx @convex-dev/auth --prod
```

This sets the `JWT_PRIVATE_KEY` and `JWKS` environment variables on the respective deployment. You can verify them in the [Convex Dashboard](https://dashboard.convex.dev/) under **Settings > Environment Variables**.

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
- **Deploy**: Auto-deploy to production on push to `main`
- **Preview**: Deploy preview on every PR

Configure these GitHub Actions secrets:

| Secret | Description |
|--------|-------------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID |
| `CONVEX_PROD_URL` | `expense-manager` project → **production** deployment URL |
| `CONVEX_DEV_URL` | `expense-manager` project → **development** deployment URL (for PR previews) |
| `CONVEX_TEST_URL` | `expense-manager-test` project → **production** deployment URL |
| `CONVEX_TEST_DEPLOY_KEY` | `expense-manager-test` project → **production** deploy key |

## Known Limitations

- **No SSR data prefetching**: All data is fetched client-side via Convex real-time subscriptions. TanStack Router `loader` functions are not used.
- **No dark mode toggle**: The app uses a light theme only. The `next-themes` dependency is present but not wired up with a `ThemeProvider`.
- **No pagination**: All expenses are loaded at once. For large datasets, this may impact performance.
- **Client-only file type validation**: Attachment file type checks happen only on the client. Convex does not support server-side MIME type validation on upload.
- **UTC date handling**: Dates are stored as `YYYY-MM-DD` strings and may shift by one day in timezones with negative UTC offsets due to UTC parsing.

## License

Private project - All rights reserved.
