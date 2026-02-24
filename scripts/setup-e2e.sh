#!/usr/bin/env bash
set -euo pipefail

echo "=== Expense Manager - E2E Test Project Setup ==="
echo ""

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "Error: Node.js is required. Install from https://nodejs.org"; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "Error: pnpm is required. Run: corepack enable pnpm"; exit 1; }

echo "This script sets up the E2E test Convex project."
echo "Prerequisites:"
echo "  - A separate Convex project (e.g., 'expense-manager-test') created in the dashboard"
echo "  - A production deploy key from that project's Settings → Deploy Keys"
echo ""

if [ ! -f .env.e2e ]; then
  if [ ! -f .env.e2e.example ]; then
    echo "Error: .env.e2e.example not found. Are you running this from the project root?"
    exit 1
  fi
  cp .env.e2e.example .env.e2e
  echo "Created .env.e2e from .env.e2e.example"
  echo "⚠  Edit .env.e2e with your test project's URL and deploy key"
  echo ""
  read -p "Press Enter once you've updated .env.e2e..."
else
  echo ".env.e2e already exists"
fi

# Load env variables safely (avoid shell injection from export+xargs)
CONVEX_DEPLOY_KEY=$(grep -m1 '^CONVEX_DEPLOY_KEY=' .env.e2e | cut -d'=' -f2-)
VITE_CONVEX_URL=$(grep -m1 '^VITE_CONVEX_URL=' .env.e2e | cut -d'=' -f2-)

# Validate deploy key
if [ -z "${CONVEX_DEPLOY_KEY}" ]; then
  echo "Error: CONVEX_DEPLOY_KEY not found in .env.e2e"
  exit 1
fi
if [ "${CONVEX_DEPLOY_KEY}" = "prod:your-test-project-deploy-key" ]; then
  echo "Error: CONVEX_DEPLOY_KEY in .env.e2e still has the placeholder value."
  echo "Update it with the production deploy key from your test Convex project, then re-run this script."
  exit 1
fi

# Validate Convex URL
if [ "${VITE_CONVEX_URL}" = "https://your-test-project.convex.cloud" ]; then
  echo "Error: VITE_CONVEX_URL in .env.e2e still has the placeholder value."
  echo "Update it with the production deployment URL from your test Convex project, then re-run this script."
  exit 1
fi

export CONVEX_DEPLOY_KEY

echo ""
echo "1. Deploying schema to test project..."
npx convex deploy

echo ""
echo "2. Configuring auth keys for test project..."
echo "   When prompted for the site URL, enter: http://localhost:3000"
npx @convex-dev/auth --prod

echo ""
echo "3. Seeding test data..."
pnpm test:e2e:seed

echo ""
echo "=== E2E Setup Complete! ==="
echo ""
echo "Run tests with: pnpm test:e2e"
