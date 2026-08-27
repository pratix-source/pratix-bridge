#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

echo "Starting Pratix Bridge..."
if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm was not found. Install Node.js 22+ and pnpm, then run this file again."
  exit 1
fi

pnpm install
pnpm dev &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT
sleep 5
if command -v open >/dev/null 2>&1; then open "http://localhost:3000"; elif command -v xdg-open >/dev/null 2>&1; then xdg-open "http://localhost:3000"; fi
echo "Pratix Bridge is available at http://localhost:3000. Keep this terminal open while using it."
wait "$SERVER_PID"
