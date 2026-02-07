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
- **UI Components**: [ShadCN UI](https://ui.shadcn.com) with custom Nova preset
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

4. Start Convex development server:
   ```bash
   npx convex dev
   ```

5. Configure authentication keys (run once per deployment):
   ```bash
   npx @convex-dev/auth
   ```
   This sets `JWT_PRIVATE_KEY` and `JWKS` on your Convex deployment.

6. In a new terminal, start the app:
   ```bash
   pnpm dev
   ```

7. Seed the predefined categories (run once):
   ```bash
   npx convex run seed:seedCategories
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
| `pnpm test:visual:update` | Update visual regression baselines |
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

E2E tests require a dedicated Convex test project:

1. Create a test Convex project: `expense-manager-test`
2. Save the URL in `.env.test`
3. Run tests:
   ```bash
   pnpm test:e2e
   ```

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

The project uses three separate Convex deployments:

| Deployment | Purpose | Configured via |
|------------|---------|----------------|
| **Development** | Local dev (`pnpm dev`) | `.env.local` |
| **Test** | E2E and visual regression tests | `.env.test` |
| **Production** | Live app (deployed from `main`) | GitHub Actions secret |

#### Setting up auth keys

Each Convex deployment requires JWT keys for authentication. Generate and set them with:

```bash
# For the dev deployment
npx @convex-dev/auth

# For the production deployment
npx @convex-dev/auth --prod
```

This sets the `JWT_PRIVATE_KEY` and `JWKS` environment variables on the respective Convex deployment. You can verify them in the [Convex Dashboard](https://dashboard.convex.dev/) under **Settings > Environment Variables**.

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
| `CONVEX_PROD_URL` | Convex **production** deployment URL |
| `CONVEX_DEV_URL` | Convex **development** deployment URL (used for PR previews) |
| `CONVEX_TEST_URL` | Convex **test** deployment URL (used for E2E and visual tests) |
| `CONVEX_TEST_DEPLOY_KEY` | Convex deploy key for the test deployment |

## License

Private project - All rights reserved.
