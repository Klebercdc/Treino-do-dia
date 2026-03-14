#!/bin/bash
set -euo pipefail

# Only run in Claude Code remote (web) sessions
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# No npm dependencies to install — api/package.json only sets commonjs type.
# Validate Node.js is available for the serverless API functions.
node --version
echo "Session environment ready."
