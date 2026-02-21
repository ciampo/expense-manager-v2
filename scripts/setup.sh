#!/usr/bin/env bash
set -euo pipefail

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
  cp .env.example .env.local
  echo "   Created .env.local from .env.example"
  echo "   ⚠  Edit .env.local with your Convex deployment URL"
  echo "   (Get it from https://dashboard.convex.dev/)"
  echo ""
  read -p "   Press Enter once you've updated .env.local..."
else
  echo "   .env.local already exists, skipping"
fi

echo ""
echo "3. Starting Convex development server..."
echo "   Run this in a separate terminal:"
echo "   npx convex dev"
echo ""
read -p "   Press Enter once 'npx convex dev' is running..."

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
