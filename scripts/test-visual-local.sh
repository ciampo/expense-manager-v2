#!/usr/bin/env bash
set -euo pipefail

# Full local visual test pipeline — mirrors CI's visual job.
#
# Steps: check CI lock → deploy Convex → migrate → cleanup stale data →
#        seed fresh data → run visual tests in Docker → cleanup on exit.
#
# Usage:
#   bash scripts/test-visual-local.sh                   # run tests
#   bash scripts/test-visual-local.sh --update-snapshots # regenerate baselines
#
# Prerequisites:
#   - .env.e2e with CONVEX_DEPLOY_KEY set (run `pnpm setup:e2e` first)
#   - Docker Desktop running
#   - gh CLI authenticated (for CI lock check)

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "Error: Node.js is required."; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "Error: pnpm is required. Run: corepack enable pnpm"; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "Error: Docker is required."; exit 1; }

source "$REPO_ROOT/scripts/check-node-version.sh"

# ---------------------------------------------------------------------------
# Load CONVEX_DEPLOY_KEY from .env.e2e (same grep+cut pattern as setup-e2e.sh)
# ---------------------------------------------------------------------------
ENV_FILE="$REPO_ROOT/.env.e2e"
if [ ! -f "$ENV_FILE" ]; then
  echo "Error: .env.e2e not found. Run 'pnpm setup:e2e' first."
  exit 1
fi

CONVEX_DEPLOY_KEY=$(grep -m1 '^CONVEX_DEPLOY_KEY=' "$ENV_FILE" | cut -d'=' -f2- | tr -d '\r' || true)
# Strip surrounding quotes
CONVEX_DEPLOY_KEY="${CONVEX_DEPLOY_KEY#\"}"
CONVEX_DEPLOY_KEY="${CONVEX_DEPLOY_KEY%\"}"
CONVEX_DEPLOY_KEY="${CONVEX_DEPLOY_KEY#\'}"
CONVEX_DEPLOY_KEY="${CONVEX_DEPLOY_KEY%\'}"

if [ -z "$CONVEX_DEPLOY_KEY" ]; then
  echo "Error: CONVEX_DEPLOY_KEY not found in .env.e2e"
  exit 1
fi
if [ "$CONVEX_DEPLOY_KEY" = "prod:your-test-project-deploy-key" ]; then
  echo "Error: CONVEX_DEPLOY_KEY in .env.e2e still has the placeholder value."
  echo "Update it with the production deploy key from your test Convex project."
  exit 1
fi

export CONVEX_DEPLOY_KEY

# ---------------------------------------------------------------------------
# Hard stop if CI holds the Convex test backend lock
# ---------------------------------------------------------------------------
check_ci_lock() {
  if ! command -v gh >/dev/null 2>&1; then
    echo "Warning: gh CLI not found — skipping CI lock check."
    echo "Install gh (https://cli.github.com) to avoid conflicts with CI."
    return 0
  fi

  local repo
  repo=$(gh repo view --json nameWithOwner --jq '.nameWithOwner' 2>/dev/null || true)
  if [ -z "$repo" ]; then
    echo "Warning: Could not determine GitHub repo — skipping CI lock check."
    return 0
  fi

  local ref_sha
  ref_sha=$(gh api "repos/$repo/git/ref/heads/mutex/convex-test-deploy" \
    --jq '.object.sha' 2>/dev/null || true)

  if [ -z "$ref_sha" ]; then
    # Lock ref doesn't exist yet — no CI runs have ever used it
    return 0
  fi

  local lock_msg
  lock_msg=$(gh api "repos/$repo/git/commits/$ref_sha" \
    --jq '.message' 2>/dev/null || true)

  if [[ "$lock_msg" == lock:* ]]; then
    echo "ERROR: Convex test backend is locked by CI."
    echo "  Lock holder: $lock_msg"
    echo ""
    echo "A CI workflow is currently deploying to or testing against the shared"
    echo "Convex test backend. Running locally now would corrupt test data."
    echo ""
    echo "Wait for the CI run to finish, then retry."
    exit 1
  fi
}

echo "=== Visual Test Local Pipeline ==="
echo ""
echo "Checking CI lock..."
check_ci_lock
echo "  No CI conflict detected."

# ---------------------------------------------------------------------------
# Guaranteed cleanup on ANY exit (success, error, Ctrl-C, SIGTERM)
# ---------------------------------------------------------------------------
CLEANUP_DONE=false
cleanup() {
  if [ "$CLEANUP_DONE" = true ]; then
    return
  fi
  CLEANUP_DONE=true

  echo ""
  echo "[cleanup] Removing test data..."
  pnpm test:e2e:cleanup 2>&1 || echo "[cleanup] Warning: cleanup failed (non-fatal)"
  echo "[cleanup] Done."
}
trap cleanup EXIT

# ---------------------------------------------------------------------------
# Mirror CI pipeline: deploy → migrate → cleanup stale → seed
# ---------------------------------------------------------------------------
echo ""
echo "1. Deploying Convex functions to test project..."
npx convex deploy

echo ""
echo "2. Running post-deploy migrations..."
npx convex run seed:postDeploy --prod

echo ""
echo "3. Cleaning up stale test data..."
pnpm test:e2e:cleanup

echo ""
echo "4. Seeding fresh test data..."
pnpm test:e2e:seed

# ---------------------------------------------------------------------------
# Run visual tests in Docker (forward extra args like --update-snapshots)
# ---------------------------------------------------------------------------
echo ""
echo "5. Running visual tests in Docker..."

if [ $# -gt 0 ]; then
  docker compose -f docker-compose.test.yml run --rm visual-tests \
    pnpm run test:visual -- "$@"
else
  docker compose -f docker-compose.test.yml run --rm visual-tests \
    pnpm run test:visual
fi

echo ""
echo "=== Visual tests complete ==="
