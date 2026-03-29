#!/usr/bin/env bash
set -euo pipefail

# Full local visual test pipeline — mirrors CI's visual job.
#
# Steps: check CI lock → deploy Convex → migrate → cleanup stale data →
#        seed fresh data → run visual tests in Docker → cleanup on exit.
#
# Usage:
#   bash scripts/test-visual-local.sh [options] [-- playwright-args...]
#
# Options:
#   --help               Show this help message and exit
#   --force              Bypass gh CLI / CI lock checks (DANGEROUS — see below)
#   --update-snapshots   Regenerate visual regression baselines
#
# Any arguments after "--" are forwarded to the Playwright test runner.
#
# Prerequisites:
#   - .env.e2e with CONVEX_DEPLOY_KEY set (run `pnpm setup:e2e` first)
#   - Docker Desktop running
#   - gh CLI installed and authenticated (for CI lock check)
#
# The script checks the shared Convex test backend mutex before deploying.
# If gh is missing, unauthenticated, or the API check fails, the script
# aborts to prevent accidental data corruption. Pass --force ONLY when you
# are CERTAIN no other test run is using the backend — locally, on other
# machines, or in CI.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

show_help() {
  cat <<'HELPTEXT'
Usage: bash scripts/test-visual-local.sh [options] [-- playwright-args...]

Full CI-equivalent local visual test pipeline. Deploys Convex functions,
runs migrations, seeds data, runs visual tests in Docker, and cleans up.

Options:
  --help               Show this help message and exit
  --force              Bypass gh CLI / CI lock safety checks (DANGEROUS)
  --update-snapshots   Regenerate visual regression baselines

Any additional arguments after "--" are forwarded to the Playwright test
runner inside the Docker container.

Prerequisites:
  .env.e2e             Must contain a valid CONVEX_DEPLOY_KEY
  Docker Desktop       Must be running
  gh CLI               Must be installed and authenticated (gh auth login)

Safety:
  This script mutates the shared Convex test backend. Before doing so it
  verifies the CI mutex ref via the GitHub API. If the check cannot be
  performed (gh missing, not authenticated, API failure) the script aborts.

  --force skips all safety checks. Use it ONLY when you are CERTAIN that
  no other test run is touching the backend — on this machine, on other
  machines, or in CI. Data corruption is possible otherwise.

Examples:
  pnpm test:visual:docker:full                       # standard run
  pnpm test:visual:docker:full -- --force             # skip lock checks
  pnpm test:visual:docker:full:update                 # update baselines
  pnpm test:visual:docker:full -- --force --update-snapshots
HELPTEXT
  exit 0
}

FORCE=false
UPDATE_SNAPSHOTS=false
PASSTHROUGH_ARGS=()

for arg in "$@"; do
  case "$arg" in
    --help|-h)
      show_help
      ;;
    --force)
      FORCE=true
      ;;
    --update-snapshots)
      UPDATE_SNAPSHOTS=true
      ;;
    *)
      PASSTHROUGH_ARGS+=("$arg")
      ;;
  esac
done

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
warn_force_bypass() {
  local reason="$1"
  echo "WARNING: $reason"
  echo "Proceeding only because --force was provided."
  echo "Use --force only when you are CERTAIN no other tests are running"
  echo "against the shared Convex test backend in parallel:"
  echo "- on this machine"
  echo "- on other machines"
  echo "- in CI"
  echo ""
}

require_or_warn_with_force() {
  local reason="$1"
  if [ "$FORCE" = true ]; then
    warn_force_bypass "$reason"
    return 0
  fi

  echo "Error: $reason"
  echo "This script requires a working GitHub CLI lock check before mutating"
  echo "the shared Convex test backend."
  echo ""
  echo "Fix the gh setup and retry, or rerun with --force only when you are"
  echo "CERTAIN no other tests are running in parallel anywhere."
  exit 1
}

check_ci_lock() {
  if ! command -v gh >/dev/null 2>&1; then
    require_or_warn_with_force "gh CLI not found."
    return 0
  fi

  if ! gh auth status >/dev/null 2>&1; then
    require_or_warn_with_force "gh CLI is not authenticated."
    return 0
  fi

  local repo
  repo=$(gh repo view --json nameWithOwner --jq '.nameWithOwner' 2>/dev/null) || {
    require_or_warn_with_force "gh repo view failed while determining the current repository."
    return 0
  }
  if [ -z "$repo" ]; then
    require_or_warn_with_force "gh repo view returned an empty repository identifier."
    return 0
  fi

  local ref_sha
  ref_sha=$(gh api "repos/$repo/git/matching-refs/heads/mutex/convex-test-deploy" \
    --jq '.[0].object.sha // empty' 2>/dev/null) || {
    require_or_warn_with_force "gh api failed while checking the CI mutex ref."
    return 0
  }

  if [ -z "$ref_sha" ]; then
    # Lock ref doesn't exist yet — no CI runs have ever used it
    return 0
  fi

  local lock_msg
  lock_msg=$(gh api "repos/$repo/git/commits/$ref_sha" \
    --jq '.message' 2>/dev/null) || {
    require_or_warn_with_force "gh api failed while reading the CI mutex commit."
    return 0
  }
  if [ -z "$lock_msg" ]; then
    require_or_warn_with_force "gh api returned an empty CI mutex commit message."
    return 0
  fi

  if [[ "$lock_msg" == lock:* ]]; then
    require_or_warn_with_force "Convex test backend is locked by CI. Lock holder: $lock_msg"
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

VISUAL_SCRIPT="test:visual"
if [ "$UPDATE_SNAPSHOTS" = true ]; then
  VISUAL_SCRIPT="test:visual:update"
fi

if [ ${#PASSTHROUGH_ARGS[@]} -gt 0 ]; then
  docker compose -f docker-compose.test.yml run --rm visual-tests \
    pnpm run "$VISUAL_SCRIPT" -- "${PASSTHROUGH_ARGS[@]}"
else
  docker compose -f docker-compose.test.yml run --rm visual-tests \
    pnpm run "$VISUAL_SCRIPT"
fi

echo ""
echo "=== Visual tests complete ==="
