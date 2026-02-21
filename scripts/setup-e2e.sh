#!/usr/bin/env bash
set -euo pipefail

echo "=== Expense Manager - E2E Test Project Setup ==="
echo ""

# Check prerequisites
command -v npx >/dev/null 2>&1 || { echo "Error: Node.js/npx is required."; exit 1; }

echo "This script sets up the E2E test Convex project."
echo "Prerequisites:"
echo "  - A separate Convex project (e.g., 'expense-manager-test') created in the dashboard"
echo "  - A production deploy key from that project's Settings → Deploy Keys"
echo ""

if [ ! -f .env.e2e ]; then
  if [ -f .env.e2e.example ]; then
    cp .env.e2e.example .env.e2e
    echo "Created .env.e2e from .env.e2e.example"
  else
    cat > .env.e2e << 'EOF'
# E2E Test Convex deployment URL
VITE_CONVEX_URL=https://your-test-project.convex.cloud

# Production deploy key for the test Convex project
CONVEX_DEPLOY_KEY=prod:your-test-project-deploy-key
EOF
    echo "Created .env.e2e template"
  fi
  echo "⚠  Edit .env.e2e with your test project's URL and deploy key"
  echo ""
  read -p "Press Enter once you've updated .env.e2e..."
else
  echo ".env.e2e already exists"
fi

# Load the deploy key
export $(grep -v '^#' .env.e2e | grep CONVEX_DEPLOY_KEY | xargs)

if [ -z "${CONVEX_DEPLOY_KEY:-}" ]; then
  echo "Error: CONVEX_DEPLOY_KEY not found in .env.e2e"
  exit 1
fi

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
