#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

BUN_BIN=""
if command -v bun >/dev/null 2>&1; then
  BUN_BIN="bun"
elif [ -x "$SCRIPT_DIR/node_modules/.bin/bun" ]; then
  BUN_BIN="$SCRIPT_DIR/node_modules/.bin/bun"
elif [ -x "$HOME/.bun/bin/bun" ]; then
  BUN_BIN="$HOME/.bun/bin/bun"
fi

if [ -n "$BUN_BIN" ]; then
  exec "$BUN_BIN" run "$SCRIPT_DIR/scripts/runner.ts" "$@"
elif command -v node >/dev/null 2>&1; then
  exec node "$SCRIPT_DIR/scripts/runner.ts" "$@"
else
  echo "[agy-ensemble] Error: Neither Bun nor Node.js was found in PATH." >&2
  echo "[agy-ensemble] Please install Bun (https://bun.sh) or Node.js (https://nodejs.org)." >&2
  exit 1
fi
