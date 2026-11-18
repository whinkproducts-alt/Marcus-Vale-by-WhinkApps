#!/usr/bin/env bash
# Nightly Marcus backup: dump the database, keep the newest KEEP dumps (default 14). Never overwrites a dump.
# Usage: scripts/ops/nightly-backup.sh [backup-dir]   (default ~/Backups/marcus)
# The dump is local only. Copying it off this machine is a separate step (see docs/OPERATIONS.md).
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
DIR=${1:-$HOME/Backups/marcus}
KEEP=${KEEP:-14}
[[ $KEEP =~ ^[1-9][0-9]*$ ]] || { echo "KEEP must be a positive integer" >&2; exit 2; }
umask 077
mkdir -p "$DIR"
C=$(cd "$ROOT" && docker compose ps -q postgres)
[ -n "$C" ] || { echo "postgres container is not running" >&2; exit 1; }
OUT="$DIR/marcus-$(date +%F-%H%M%S).dump"
[ ! -e "$OUT" ] || { echo "refusing to overwrite $OUT" >&2; exit 1; }
trap 'rm -f "$OUT.partial"' EXIT
"$ROOT/scripts/ops/db-backup.sh" "$C" marcus whink "$OUT"
# Prune only after a good backup; only files that match this script's own name pattern.
ls -1t "$DIR"/marcus-*.dump | tail -n +$((KEEP + 1)) | while IFS= read -r old; do rm -f -- "$old"; done
