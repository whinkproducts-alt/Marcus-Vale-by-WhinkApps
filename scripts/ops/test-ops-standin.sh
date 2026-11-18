#!/usr/bin/env bash
# Tests the Marcus ops scripts against a REAL local Postgres through a stand-in docker (scripts/ops/standin/docker).
# Runs without a Docker daemon. Needs Postgres 16 server binaries and root (initdb runs as the postgres OS user).
# It proves the script logic (restore drill, retention, refusals, the restore swap procedure in docs/OPERATIONS.md).
# It does NOT prove the pgvector image, the backend's init_db schema, or docker compose: run test-restore.sh on a Docker host.
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
export STANDIN_DIR; STANDIN_DIR=$(mktemp -d)
export PATH="$ROOT/scripts/ops/standin:$PATH"
cleanup() { for p in "$STANDIN_DIR"/*.port; do [ -e "$p" ] && docker rm -f "$(basename "$p" .port)" || true; done; rm -rf "$STANDIN_DIR"; }
trap cleanup EXIT
ok() { echo "ok: $*"; }
die() { echo "FAIL: $*" >&2; exit 1; }
Q() { docker exec "$1" psql -U postgres -d "$2" -tAc "$3"; }

# 1. The restore drill, unmodified, with a schema step that needs no pgvector.
SCHEMA_CMD='for t in users approvals tasks memory spend_log echelon_handoffs action_trust control_state settings chat_messages; do Q src "CREATE TABLE $t(id serial primary key, v text)"; done
Q src "CREATE TABLE briefings(id uuid primary key default gen_random_uuid(), kind text, text text, delivered boolean, created_at timestamptz default now())"' \
  "$ROOT/scripts/ops/test-restore.sh" | tee "$STANDIN_DIR/drill.out"
grep -q '^PASS: 11 tables' "$STANDIN_DIR/drill.out" || die "drill did not report PASS for 11 tables"
ok "restore drill: backup, restore, populated target refused, 11 tables identical"

# 2. Nightly backup: retention, no overwrite of kept dumps, nothing pruned when a backup fails.
C=marcus-standin-db; BD=$STANDIN_DIR/backups; mkdir -p "$BD"
docker run -d --name "$C" -e POSTGRES_DB=marcus -p 127.0.0.1:55432:5432 pgvector/pgvector:pg16 >/dev/null
docker exec "$C" psql -U postgres -d postgres -c 'CREATE ROLE whink SUPERUSER LOGIN' >/dev/null
Q "$C" marcus "CREATE TABLE briefings(id serial primary key, text text); INSERT INTO briefings(text) SELECT 'x'||g FROM generate_series(1,25) g" >/dev/null
echo "$C" > "$STANDIN_DIR/compose-container"
for d in 01 02 03 04 05; do touch -t 20200101${d}00 "$BD/marcus-2020-01-$d-000000.dump"; done
KEEP=3 "$ROOT/scripts/ops/nightly-backup.sh" "$BD" >/dev/null
[ "$(ls "$BD"/marcus-*.dump | wc -l | tr -d ' ')" = 3 ] || die "retention kept $(ls "$BD"/marcus-*.dump | wc -l) dumps, want 3"
NEWEST=$(ls -1t "$BD"/marcus-*.dump | head -1)
case "$NEWEST" in *2020-01-*) die "the new dump is not the newest file" ;; esac
pg_restore -l "$NEWEST" >/dev/null || die "newest dump is not a valid pg_restore archive"
[ ! -e "$NEWEST.partial" ] || die "partial file left behind"
ok "nightly backup: 3 kept, newest is the real dump and restores-listable"
BEFORE=$(ls "$BD" | sort | tr '\n' ' ')
echo "no-such-container" > "$STANDIN_DIR/compose-container"
if KEEP=1 "$ROOT/scripts/ops/nightly-backup.sh" "$BD" >/dev/null 2>&1; then die "backup of a missing container succeeded"; fi
[ "$(ls "$BD" | sort | tr '\n' ' ')" = "$BEFORE" ] || die "a failed backup changed the backup folder (pruned or left a partial file)"
ok "failed backup: nothing pruned, no partial file"
echo "$C" > "$STANDIN_DIR/compose-container"
if KEEP=0 "$ROOT/scripts/ops/nightly-backup.sh" "$BD" >/dev/null 2>&1; then die "KEEP=0 was accepted"; fi
ok "KEEP=0 refused"

# 3. The restore swap procedure from docs/OPERATIONS.md: restore to a new name, rename, old data kept as marcus_old.
Q "$C" marcus "DELETE FROM briefings" >/dev/null
"$ROOT/scripts/ops/db-restore.sh" "$C" marcus_restored whink "$NEWEST" >/dev/null
docker exec "$C" psql -U whink -d postgres -c 'ALTER DATABASE marcus RENAME TO marcus_old' >/dev/null
docker exec "$C" psql -U whink -d postgres -c 'ALTER DATABASE marcus_restored RENAME TO marcus' >/dev/null
[ "$(Q "$C" marcus 'SELECT count(*) FROM briefings')" = 25 ] || die "swapped-in database does not hold the 25 backed-up rows"
[ "$(Q "$C" marcus_old 'SELECT count(*) FROM briefings')" = 0 ] || die "old database was not kept intact"
ok "restore swap: marcus has the 25 backed-up rows, marcus_old kept"

# 4. start-stack: waits for docker, then runs compose up -d; fails clearly when docker never comes up.
WAIT_SECONDS=5 "$ROOT/scripts/ops/start-stack.sh"
grep -q 'compose up -d' "$STANDIN_DIR/calls" || die "start-stack did not run compose up -d"
if STANDIN_DOCKER_DOWN=1 WAIT_SECONDS=5 "$ROOT/scripts/ops/start-stack.sh" >/dev/null 2>&1; then die "start-stack succeeded with docker down"; fi
ok "start-stack: runs compose up -d; fails when docker never starts"
echo "ALL STAND-IN CHECKS PASSED"
