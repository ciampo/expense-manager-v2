#!/usr/bin/env bash
# Validates that the running Node.js version satisfies .nvmrc (full semver).
# Source this from setup scripts: source scripts/check-node-version.sh

set -euo pipefail

if [ -f .nvmrc ]; then
  REQUIRED_NODE=$(cat .nvmrc | tr -d '[:space:]' | sed 's/^v//')
  CURRENT_NODE=$(node -v | sed 's/^v//')
  LOWEST=$(printf '%s\n%s\n' "$REQUIRED_NODE" "$CURRENT_NODE" | sort -V | head -n1)
  if [ "$LOWEST" != "$REQUIRED_NODE" ]; then
    echo "Error: Node.js >= $REQUIRED_NODE is required (found $CURRENT_NODE)."
    echo "Run: nvm install $REQUIRED_NODE"
    exit 1
  fi
fi
