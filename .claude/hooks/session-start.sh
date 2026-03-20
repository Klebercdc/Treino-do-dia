#!/bin/bash
set -euo pipefail

# Only run in Claude Code remote (web) sessions
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# ── Install rclone if not present ─────────────────────────
if ! command -v rclone &>/dev/null; then
  echo "Installing rclone..."
  apt-get install -y rclone
fi

rclone version

# ── Validate Node.js for serverless API functions ─────────
node --version

echo "Session environment ready."
