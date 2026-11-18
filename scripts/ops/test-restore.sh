#!/usr/bin/env bash
# Proves Marcus backup and restore: throwaway pgvector container, the backend's own schema, seed rows, back up, restore into
# a second database, compare exact row counts of EVERY public table, and check a populated target is refused.
# Needs Docker and the backend Python deps (pip install -r backend/requirements.txt; PYTHON=path/to/venv/python overrides).
# SCHEMA_CMD overrides the schema step (the stand-in test uses it because that Postgres has no pgvector).
# Usage: scripts/ops/test-restore.sh
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
H=$(printf %s "$ROOT" | cksum | cut -d" " -f1)
C=marcus-restoretest-$H; PORT=$((57000 + H % 500))
T=$(mktemp -d); trap 'docker rm -f "$C" >/dev/null 2>&1 || true; rm -rf "$T"' EXIT
docker rm -f "$C" >/dev/null 2>&1 || true
docker run -d --name "$C" -e POSTGRES_PASSWORD=t -e POSTGRES_DB=src -p 127.0.0.1:$PORT:5432 pgvector/pgvector:pg16 >/dev/null
for _ in $(seq 1 40); do docker exec "$C" pg_isready -U postgres >/dev/null 2>&1 && break; sleep 1; done; sleep 3
Q() { docker exec "$C" psql -U postgres -d "$1" -tAc "$2"; }
if [ -n "${SCHEMA_CMD:-}" ]; then
  eval "$SCHEMA_CMD"
else
  # Throwaway values only: they exist so the backend's settings load, and point at the throwaway container.
  (cd "$ROOT/backend" && DATABASE_URL="postgresql+asyncpg://postgres:t@127.0.0.1:$PORT/src" API_KEY=drill-throwaway-key-0000 \
    OMNIROUTE_API_KEY=drill-throwaway "${PYTHON:-python3}" -c 'import asyncio, database; asyncio.run(database.init_db())')
fi
Q src "INSERT INTO briefings(id,kind,text,delivered) SELECT gen_random_uuid(),'morning','seed '||g,false FROM generate_series(1,25) g"
# Exact row count of every public table (not estimates).
counts() { Q "$1" "SELECT string_agg(format('SELECT %L||'':''||count(*) FROM %I', tablename, tablename), ' UNION ALL ' ORDER BY tablename) FROM pg_tables WHERE schemaname='public'" \
  | { read -r sql; Q "$1" "$sql"; } | sort; }
"$ROOT/scripts/ops/db-backup.sh" "$C" src postgres "$T/b.dump"
"$ROOT/scripts/ops/db-restore.sh" "$C" restored postgres "$T/b.dump"
if "$ROOT/scripts/ops/db-restore.sh" "$C" restored postgres "$T/b.dump" >/dev/null 2>&1; then echo "FAIL: restore overwrote a populated db" >&2; exit 1; fi
counts src > "$T/a.txt"; counts restored > "$T/b.txt"
grep -q '^briefings:25$' "$T/b.txt" || { echo "FAIL: seeded rows missing after restore" >&2; exit 1; }
[ "$(wc -l < "$T/a.txt")" -ge 10 ] || { echo "FAIL: too few tables compared" >&2; exit 1; }
diff "$T/a.txt" "$T/b.txt" && echo "PASS: $(wc -l < "$T/a.txt" | tr -d ' ') tables, row counts identical after restore"
