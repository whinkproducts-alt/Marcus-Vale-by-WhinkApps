#!/usr/bin/env bash
# Start the Marcus stack once Docker is up. For a login launchd job: Docker Desktop/OrbStack is not ready at login, so wait.
# Usage: scripts/ops/start-stack.sh      (WAIT_SECONDS, default 300)
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
WAIT=${WAIT_SECONDS:-300}
for ((i = 0; i < WAIT; i += 5)); do
  docker info >/dev/null 2>&1 && break
  sleep 5
done
docker info >/dev/null 2>&1 || { echo "docker not ready after ${WAIT}s" >&2; exit 1; }
cd "$ROOT" && docker compose up -d
