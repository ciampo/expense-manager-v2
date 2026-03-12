#!/usr/bin/env bash
# Validates that the running Node.js major version satisfies .nvmrc.
# Source this from setup scripts: source scripts/check-node-version.sh

set -euo pipefail

if [ -f .nvmrc ]; then
  REQUIRED_NODE=$(cat .nvmrc | tr -d '[:space:]' | sed 's/^v//')
  CURRENT_NODE=$(node -v | sed 's/^v//')
  REQUIRED_MAJOR=$(echo "$REQUIRED_NODE" | cut -d. -f1)
  CURRENT_MAJOR=$(echo "$CURRENT_NODE" | cut -d. -f1)
  if [ "$CURRENT_MAJOR" -lt "$REQUIRED_MAJOR" ]; then
    echo "Error: Node.js >= $REQUIRED_NODE is required (found $CURRENT_NODE)."
    echo "Run: nvm install $REQUIRED_NODE"
    exit 1
  fi
fi
