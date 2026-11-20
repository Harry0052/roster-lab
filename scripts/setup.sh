#!/usr/bin/env bash
# One command for a Mac (or Linux) with Node.js 22.
# Google Chrome is required for the local browser workspace.
# Docker Desktop is optional and is not used unless it is already running.
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v node >/dev/null 2>&1; then
  echo "Install Node.js 22, then run this again."
  exit 1
fi

npm install

if [[ ! -x "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" && ! -x "/usr/local/bin/google-chrome" && ! -x "/usr/bin/google-chrome" && -z "${ROSTER_LAB_CHROME:-}" ]]; then
  echo "Google Chrome was not found. Install it, or set ROSTER_LAB_CHROME to the browser binary."
  exit 1
fi

if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  echo "Docker is running. This build still opens a local Chrome profile. A container desktop was not verified in the session that wrote this script."
else
  echo "Docker is not running. The workspace will be a local browser profile, not an isolated VM."
fi

echo "Starting Roster Lab and the Software Engineer demo."
npm run dev &
dev_pid=$!
trap 'kill "$dev_pid"' INT TERM EXIT
for _ in $(seq 1 40); do
  if curl -sf "http://127.0.0.1:4317/api/health" >/dev/null; then
    break
  fi
  sleep 0.25
done
curl -sf -X POST "http://127.0.0.1:4317/api/demo/main-bot" \
  -H "content-type: application/json" \
  -H "x-roster-request: 1" \
  -d "{}" >/tmp/roster-lab-demo.json
echo "Open http://127.0.0.1:4318 and choose Main bot demo."
echo "The Software Engineer workspace is a local browser profile, not an isolated VM."
wait "$dev_pid"
