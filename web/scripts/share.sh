#!/usr/bin/env bash
# Share a password-protected preview of Solera over the internet (temporary Cloudflare quick tunnel).
# Usage:  cd web && SITE_PASSWORD='choose-a-password' ./scripts/share.sh
# Stop with Ctrl+C (closes the public link). Needs: brew install cloudflared
set -euo pipefail
cd "$(dirname "$0")/.."

: "${SITE_PASSWORD:?Set SITE_PASSWORD, e.g. SITE_PASSWORD='something-long' ./scripts/share.sh}"
PORT="${PORT:-3100}"
LOG="$(mktemp -t solera-tunnel)"

cloudflared tunnel --no-autoupdate --url "http://localhost:$PORT" >"$LOG" 2>&1 &
TUNNEL_PID=$!
trap 'kill $TUNNEL_PID ${SERVER_PID:-} 2>/dev/null; rm -f "$LOG"' EXIT

echo "Opening tunnel…"
URL=""
for _ in $(seq 1 60); do
  URL="$(grep -Eo 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOG" | head -1 || true)"
  [ -n "$URL" ] && break
  sleep 1
done
[ -n "$URL" ] || { echo "Tunnel did not start:"; cat "$LOG"; exit 1; }

# iCloud "Optimize Mac Storage" can leave empty placeholders for project files; fetch them before building.
echo "Checking project files…"
{ find src data prisma -type f -print0 2>/dev/null | xargs -0 ls -lO 2>/dev/null | grep dataless || true; } | awk '{print $NF}' | while read -r f; do
  brctl download "$f" 2>/dev/null || true
done
find src data prisma -type f -print0 2>/dev/null | xargs -0 cat >/dev/null 2>&1 || true

echo "Building the production app…"
BUILD_LOG="$(mktemp -t solera-build)"
if ! APP_URL="$URL" npx next build >"$BUILD_LOG" 2>&1; then
  echo "Build failed. Details:"
  grep -v '^ *$' "$BUILD_LOG" | tail -40
  echo
  echo "If it mentions an empty file or a missing export, wait 20 seconds and run this script again."
  exit 1
fi
rm -f "$BUILD_LOG"

echo
echo "  Share this link:  $URL"
echo "  Password:         (the SITE_PASSWORD you chose; any username)"
echo "  Test emails:      $URL/dev/outbox"
echo
APP_URL="$URL" SITE_PASSWORD="$SITE_PASSWORD" ENABLE_OUTBOX=1 npx next start -p "$PORT" &
SERVER_PID=$!
wait $SERVER_PID
