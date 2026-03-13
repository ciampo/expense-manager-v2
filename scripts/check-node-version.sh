#!/usr/bin/env bash
# Validates that the running Node.js version (numeric major.minor.patch)
# satisfies the minimum version specified in .nvmrc.
# Source this from setup scripts: source "$(dirname ...)/check-node-version.sh"
#
# Expects REPO_ROOT to be set by the caller (the directory containing .nvmrc).

set -euo pipefail

version_ge() {
  local c_major c_minor c_patch r_major r_minor r_patch
  IFS=. read -r c_major c_minor c_patch <<<"$1"
  IFS=. read -r r_major r_minor r_patch <<<"$2"
  c_minor=${c_minor:-0}; c_patch=${c_patch:-0}
  r_minor=${r_minor:-0}; r_patch=${r_patch:-0}

  [ "$c_major" -gt "$r_major" ] && return 0
  [ "$c_major" -lt "$r_major" ] && return 1
  [ "$c_minor" -gt "$r_minor" ] && return 0
  [ "$c_minor" -lt "$r_minor" ] && return 1
  [ "$c_patch" -ge "$r_patch" ]
}

NVMRC="${REPO_ROOT:-.}/.nvmrc"
if [ -f "$NVMRC" ]; then
  REQUIRED_NODE=$(cat "$NVMRC" | tr -d '[:space:]' | sed 's/^v//')
  CURRENT_NODE=$(node -v | sed 's/^v//')
  if ! version_ge "$CURRENT_NODE" "$REQUIRED_NODE"; then
    echo "Error: Node.js >= $REQUIRED_NODE is required (found $CURRENT_NODE)."
    echo "Run: nvm install $REQUIRED_NODE"
    exit 1
  fi
fi
