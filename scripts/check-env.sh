#!/usr/bin/env bash
# Audits environment variable declarations across all environments.
# Checks variable NAMES only (never prints values).
#
# Usage:
#   pnpm check:env                          # check everything reachable
#   pnpm check:env --skip-remote            # only check local env files
#   CONVEX_PROD_DEPLOY_KEY='prod:...' pnpm check:env  # also check prod Convex

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# ---------------------------------------------------------------------------
# Options
# ---------------------------------------------------------------------------
SKIP_REMOTE=false
for arg in "$@"; do
  case "$arg" in
    --skip-remote) SKIP_REMOTE=true ;;
    *) echo "Unknown option: $arg"; exit 2 ;;
  esac
done

# ---------------------------------------------------------------------------
# Colors (disabled when stdout is not a TTY)
# ---------------------------------------------------------------------------
if [ -t 1 ]; then
  RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'
  CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; CYAN=''; BOLD=''; RESET=''
fi

# ---------------------------------------------------------------------------
# State
# ---------------------------------------------------------------------------
ERRORS=0

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

header() {
  echo ""
  echo -e "${BOLD}${CYAN}=== $1 ===${RESET}"
}

# Parse variable names from an env file (ignores comments, blank lines, exports)
parse_env_file() {
  local file="$1"
  grep -E '^[A-Za-z_][A-Za-z0-9_]*=' "$file" 2>/dev/null | cut -d= -f1 | sort -u
}

# Check that all required vars are present in the actual list.
# Usage: check_required "ACTUAL_VARS" "REQUIRED_VAR1 REQUIRED_VAR2 ..."
check_required() {
  local actual="$1"; shift
  local missing=0
  for var in "$@"; do
    if ! echo "$actual" | grep -qx "$var"; then
      echo -e "  ${RED}MISSING${RESET}  $var"
      missing=1
    fi
  done
  return $missing
}

# Check that no unexpected vars are present.
# Usage: check_unexpected "ACTUAL_VARS" "KNOWN_VAR1 KNOWN_VAR2 ..."
check_unexpected() {
  local actual="$1"; shift
  local known="$*"
  local unexpected=0
  while IFS= read -r var; do
    [ -z "$var" ] && continue
    local found=false
    for k in $known; do
      if [ "$var" = "$k" ]; then found=true; break; fi
    done
    if [ "$found" = false ]; then
      echo -e "  ${YELLOW}UNEXPECTED${RESET}  $var"
      unexpected=1
    fi
  done <<< "$actual"
  return $unexpected
}

# Run both checks for an environment, update ERRORS.
# Usage: audit_env "ACTUAL_VARS" "required_arr" "known_arr"
audit_env() {
  local actual="$1"
  local required="$2"
  local known="$3"
  local env_ok=true

  # shellcheck disable=SC2086
  if ! check_required "$actual" $required; then env_ok=false; fi
  # shellcheck disable=SC2086
  if ! check_unexpected "$actual" $known; then env_ok=false; fi

  if [ "$env_ok" = true ]; then
    echo -e "  ${GREEN}OK${RESET} — all expected variables present, no unexpected variables"
  else
    ERRORS=$((ERRORS + 1))
  fi
}

# Fetch Convex env var names using a deploy key.
# Usage: convex_env_names [DEPLOY_KEY]
# If DEPLOY_KEY is empty, uses the default dev deployment.
convex_env_names() {
  local key="${1:-}"
  if [ -n "$key" ]; then
    CONVEX_DEPLOY_KEY="$key" npx convex env list 2>/dev/null | cut -d= -f1 | sort -u
  else
    npx convex env list 2>/dev/null | cut -d= -f1 | sort -u
  fi
}

# ---------------------------------------------------------------------------
# Variable definitions
# ---------------------------------------------------------------------------

# .env.local
LOCAL_REQUIRED="VITE_CONVEX_URL CONVEX_DEPLOYMENT"
LOCAL_OPTIONAL="VITE_TURNSTILE_SITE_KEY CONVEX_DEPLOY_KEY"
LOCAL_KNOWN="$LOCAL_REQUIRED $LOCAL_OPTIONAL"

# .env.e2e
E2E_REQUIRED="VITE_CONVEX_URL CONVEX_DEPLOY_KEY VITE_TURNSTILE_SITE_KEY"
E2E_KNOWN="$E2E_REQUIRED"

# GitHub Secrets
GH_REQUIRED="CLOUDFLARE_ACCOUNT_ID CLOUDFLARE_API_TOKEN CONVEX_DEV_URL CONVEX_PROD_DEPLOY_KEY CONVEX_PROD_URL CONVEX_TEST_DEPLOY_KEY CONVEX_TEST_URL TURNSTILE_SITE_KEY"
GH_KNOWN="$GH_REQUIRED"

# Convex — shared across deployments
CONVEX_AUTH_REQUIRED="SITE_URL JWT_PRIVATE_KEY JWKS"
CONVEX_APP_OPTIONAL="AUTH_RESEND_KEY AUTH_RESEND_FROM TURNSTILE_SECRET_KEY ALLOWED_EMAILS REGISTRATION_ENABLED"

# Convex dev
CONVEX_DEV_REQUIRED="$CONVEX_AUTH_REQUIRED"
CONVEX_DEV_KNOWN="$CONVEX_DEV_REQUIRED $CONVEX_APP_OPTIONAL"

# Convex test (adds E2E_CLEANUP_ALLOWED, drops AUTH_RESEND_FROM)
CONVEX_TEST_REQUIRED="$CONVEX_AUTH_REQUIRED E2E_CLEANUP_ALLOWED"
CONVEX_TEST_OPTIONAL="AUTH_RESEND_KEY TURNSTILE_SECRET_KEY ALLOWED_EMAILS REGISTRATION_ENABLED"
CONVEX_TEST_KNOWN="$CONVEX_TEST_REQUIRED $CONVEX_TEST_OPTIONAL"

# Convex prod (same as dev)
CONVEX_PROD_REQUIRED="$CONVEX_AUTH_REQUIRED"
CONVEX_PROD_KNOWN="$CONVEX_PROD_REQUIRED $CONVEX_APP_OPTIONAL"

# ---------------------------------------------------------------------------
# 1. .env.local
# ---------------------------------------------------------------------------
header ".env.local"
if [ -f .env.local ]; then
  ACTUAL=$(parse_env_file .env.local)
  audit_env "$ACTUAL" "$LOCAL_REQUIRED" "$LOCAL_KNOWN"
else
  echo -e "  ${YELLOW}SKIPPED${RESET} — file not found"
fi

# ---------------------------------------------------------------------------
# 2. .env.e2e
# ---------------------------------------------------------------------------
header ".env.e2e"
if [ -f .env.e2e ]; then
  ACTUAL=$(parse_env_file .env.e2e)
  audit_env "$ACTUAL" "$E2E_REQUIRED" "$E2E_KNOWN"
else
  echo -e "  ${YELLOW}SKIPPED${RESET} — file not found"
fi

# ---------------------------------------------------------------------------
# Remote checks
# ---------------------------------------------------------------------------
if [ "$SKIP_REMOTE" = true ]; then
  echo ""
  echo -e "${YELLOW}Skipping remote checks (--skip-remote)${RESET}"
else

  # -------------------------------------------------------------------------
  # 3. GitHub Secrets
  # -------------------------------------------------------------------------
  header "GitHub Secrets"
  if ! command -v gh >/dev/null 2>&1; then
    echo -e "  ${YELLOW}SKIPPED${RESET} — gh CLI not installed"
  elif ! gh auth status >/dev/null 2>&1; then
    echo -e "  ${YELLOW}SKIPPED${RESET} — gh CLI not authenticated (run 'gh auth login')"
  else
    ACTUAL=$(gh secret list --json name -q '.[].name' 2>/dev/null | sort -u)
    audit_env "$ACTUAL" "$GH_REQUIRED" "$GH_KNOWN"
  fi

  # -------------------------------------------------------------------------
  # 4. Convex dev
  # -------------------------------------------------------------------------
  header "Convex dev (expense-manager → development)"
  if [ ! -f .env.local ] || ! grep -q '^CONVEX_DEPLOYMENT=' .env.local 2>/dev/null; then
    echo -e "  ${YELLOW}SKIPPED${RESET} — no CONVEX_DEPLOYMENT in .env.local (run 'npx convex dev' first)"
  else
    ACTUAL=$(convex_env_names "")
    if [ -z "$ACTUAL" ]; then
      echo -e "  ${YELLOW}SKIPPED${RESET} — could not reach Convex dev deployment"
    else
      audit_env "$ACTUAL" "$CONVEX_DEV_REQUIRED" "$CONVEX_DEV_KNOWN"
    fi
  fi

  # -------------------------------------------------------------------------
  # 5. Convex test
  # -------------------------------------------------------------------------
  header "Convex test (expense-manager-test → production)"
  TEST_DEPLOY_KEY=""
  if [ -f .env.e2e ]; then
    TEST_DEPLOY_KEY=$(grep -m1 '^CONVEX_DEPLOY_KEY=' .env.e2e | cut -d= -f2- | tr -d '\r' || true)
  fi
  if [ -z "$TEST_DEPLOY_KEY" ]; then
    echo -e "  ${YELLOW}SKIPPED${RESET} — no CONVEX_DEPLOY_KEY in .env.e2e"
  else
    ACTUAL=$(convex_env_names "$TEST_DEPLOY_KEY")
    if [ -z "$ACTUAL" ]; then
      echo -e "  ${YELLOW}SKIPPED${RESET} — could not reach Convex test deployment"
    else
      audit_env "$ACTUAL" "$CONVEX_TEST_REQUIRED" "$CONVEX_TEST_KNOWN"
    fi
  fi

  # -------------------------------------------------------------------------
  # 6. Convex prod
  # -------------------------------------------------------------------------
  header "Convex prod (expense-manager → production)"
  PROD_DEPLOY_KEY="${CONVEX_PROD_DEPLOY_KEY:-}"
  if [ -z "$PROD_DEPLOY_KEY" ]; then
    echo -e "  ${YELLOW}SKIPPED${RESET} — set CONVEX_PROD_DEPLOY_KEY env var to check production"
  else
    ACTUAL=$(convex_env_names "$PROD_DEPLOY_KEY")
    if [ -z "$ACTUAL" ]; then
      echo -e "  ${YELLOW}SKIPPED${RESET} — could not reach Convex prod deployment"
    else
      audit_env "$ACTUAL" "$CONVEX_PROD_REQUIRED" "$CONVEX_PROD_KNOWN"
    fi
  fi

  # -------------------------------------------------------------------------
  # 7. Turnstile key pairing cross-check
  # -------------------------------------------------------------------------
  header "Turnstile key pairing"

  PAIRING_OK=true

  # Dev: TURNSTILE_SECRET_KEY on Convex dev ↔ VITE_TURNSTILE_SITE_KEY in .env.local
  if [ -f .env.local ] && grep -q '^CONVEX_DEPLOYMENT=' .env.local 2>/dev/null; then
    DEV_VARS=$(convex_env_names "" 2>/dev/null || true)
    DEV_HAS_SECRET=$(echo "$DEV_VARS" | grep -cx "TURNSTILE_SECRET_KEY" || true)
    LOCAL_HAS_SITE=$(grep -c '^VITE_TURNSTILE_SITE_KEY=.\+' .env.local 2>/dev/null || true)
    if [ "$DEV_HAS_SECRET" -gt 0 ] && [ "$LOCAL_HAS_SITE" -eq 0 ]; then
      echo -e "  ${RED}MISMATCH${RESET}  Convex dev has TURNSTILE_SECRET_KEY but .env.local is missing VITE_TURNSTILE_SITE_KEY"
      echo -e "           Remove it from dev: npx convex env remove TURNSTILE_SECRET_KEY"
      PAIRING_OK=false
    fi
  fi

  # Test: TURNSTILE_SECRET_KEY on Convex test ↔ VITE_TURNSTILE_SITE_KEY in .env.e2e
  if [ -n "${TEST_DEPLOY_KEY:-}" ]; then
    TEST_VARS=$(convex_env_names "$TEST_DEPLOY_KEY" 2>/dev/null || true)
    TEST_HAS_SECRET=$(echo "$TEST_VARS" | grep -cx "TURNSTILE_SECRET_KEY" || true)
    E2E_HAS_SITE=$(grep -c '^VITE_TURNSTILE_SITE_KEY=.\+' .env.e2e 2>/dev/null || true)
    if [ "$TEST_HAS_SECRET" -gt 0 ] && [ "$E2E_HAS_SITE" -eq 0 ]; then
      echo -e "  ${RED}MISMATCH${RESET}  Convex test has TURNSTILE_SECRET_KEY but .env.e2e is missing VITE_TURNSTILE_SITE_KEY"
      PAIRING_OK=false
    elif [ "$TEST_HAS_SECRET" -eq 0 ] && [ "$E2E_HAS_SITE" -gt 0 ]; then
      echo -e "  ${YELLOW}WARNING${RESET}   .env.e2e has VITE_TURNSTILE_SITE_KEY but Convex test is missing TURNSTILE_SECRET_KEY"
    fi
  fi

  # Prod: TURNSTILE_SECRET_KEY on Convex prod ↔ TURNSTILE_SITE_KEY in GH Secrets
  if [ -n "${PROD_DEPLOY_KEY:-}" ]; then
    PROD_VARS=$(convex_env_names "$PROD_DEPLOY_KEY" 2>/dev/null || true)
    PROD_HAS_SECRET=$(echo "$PROD_VARS" | grep -cx "TURNSTILE_SECRET_KEY" || true)
    GH_CHECK_OK=false
    GH_HAS_SITE=0
    if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
      if GH_SECRET_NAMES=$(gh secret list --json name -q '.[].name' 2>/dev/null); then
        GH_HAS_SITE=$(echo "$GH_SECRET_NAMES" | grep -cx "TURNSTILE_SITE_KEY" || true)
        GH_CHECK_OK=true
      fi
    fi
    if [ "$PROD_HAS_SECRET" -gt 0 ] && [ "$GH_CHECK_OK" = true ] && [ "$GH_HAS_SITE" -eq 0 ]; then
      echo -e "  ${RED}MISMATCH${RESET}  Convex prod has TURNSTILE_SECRET_KEY but GitHub is missing TURNSTILE_SITE_KEY secret"
      PAIRING_OK=false
    elif [ "$PROD_HAS_SECRET" -gt 0 ] && [ "$GH_CHECK_OK" = false ]; then
      echo -e "  ${YELLOW}WARNING${RESET}   Convex prod has TURNSTILE_SECRET_KEY but GitHub TURNSTILE_SITE_KEY could not be verified (gh CLI unavailable)"
    elif [ "$PROD_HAS_SECRET" -eq 0 ] && [ "$GH_CHECK_OK" = true ] && [ "$GH_HAS_SITE" -gt 0 ]; then
      echo -e "  ${YELLOW}WARNING${RESET}   GitHub has TURNSTILE_SITE_KEY but Convex prod is missing TURNSTILE_SECRET_KEY"
    fi
  fi

  if [ "$PAIRING_OK" = false ]; then
    ERRORS=$((ERRORS + 1))
  elif [ "$PAIRING_OK" = true ]; then
    echo -e "  ${GREEN}OK${RESET} — Turnstile keys are consistently paired across checked environments"
  fi

fi # end remote checks

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
if [ "$ERRORS" -gt 0 ]; then
  echo -e "${RED}${BOLD}FAIL${RESET} — $ERRORS environment(s) have issues"
  exit 1
else
  echo -e "${GREEN}${BOLD}PASS${RESET} — all checked environments look good"
  exit 0
fi
