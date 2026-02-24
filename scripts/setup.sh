#!/usr/bin/env bash
set -euo pipefail

if [ ! -t 0 ]; then
  echo "Error: This script requires an interactive terminal."
  exit 1
fi

echo "=== Expense Manager - Local Development Setup ==="
echo ""

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "Error: Node.js is required. Install from https://nodejs.org"; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "Error: pnpm is required. Run: corepack enable pnpm"; exit 1; }

echo "1. Installing dependencies..."
pnpm install

echo ""
echo "2. Setting up environment variables..."
if [ ! -f .env.local ]; then
  if [ ! -f .env.example ]; then
    echo "Error: .env.example not found. Are you running this from the project root?"
    exit 1
  fi
  cp .env.example .env.local
  echo "   Created .env.local from .env.example"
  echo ""
  echo "   ⚠  Edit .env.local with your Convex development deployment URL:"
  echo "     1. Go to https://dashboard.convex.dev/"
  echo "     2. Create a new project (or select an existing one)"
  echo "     3. Use the deployment switcher to select 'Development'"
  echo "     4. Copy the deployment URL and paste it as VITE_CONVEX_URL"
  echo ""
  read -p "   Press Enter once you've updated .env.local..." || true
else
  echo "   .env.local already exists, skipping"
fi

# Validate that VITE_CONVEX_URL has been customised.
# `|| true` prevents pipefail from exiting when the key is missing.
# `tr -d '\r'` strips Windows carriage returns from the value.
CONVEX_URL=$(grep -m1 '^VITE_CONVEX_URL=' .env.local | cut -d'=' -f2- | tr -d '\r' || true)
if [ -z "${CONVEX_URL}" ]; then
  echo "Error: VITE_CONVEX_URL is empty or missing in .env.local"
  exit 1
fi
if [ "${CONVEX_URL}" = "https://your-project.convex.cloud" ]; then
  echo "Error: VITE_CONVEX_URL in .env.local still has the placeholder value."
  echo "Update it with your Convex deployment URL, then re-run this script."
  exit 1
fi

echo ""
echo "3. Starting Convex development server..."
echo "   Run this in a separate terminal:"
echo "   npx convex dev"
echo ""
read -p "   Press Enter once 'npx convex dev' is running..." || true

# Validate that npx convex dev has initialized the deployment
if ! grep -q '^CONVEX_DEPLOYMENT=' .env.local 2>/dev/null; then
  echo "Error: CONVEX_DEPLOYMENT not found in .env.local"
  echo "Please ensure 'npx convex dev' is running in another terminal and has finished initializing."
  exit 1
fi

echo ""
echo "4. Configuring authentication keys..."
echo "   When prompted for the site URL, enter: http://localhost:3000"
npx @convex-dev/auth

echo ""
echo "5. Seeding predefined categories..."
npx convex run seed:seedCategories

echo ""
echo "=== Setup complete! ==="
echo ""
echo "Start the app with: pnpm dev"
echo "Open http://localhost:3000"
