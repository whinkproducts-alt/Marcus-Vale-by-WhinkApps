# Marcus operations: always on, backups, restore

Marcus runs in Docker on one Mac. Every phone, tablet and laptop is only a browser pointed at that Mac (see [TAILSCALE.md](TAILSCALE.md)). If the Mac is asleep or Docker is down, Marcus is down for every device, and scheduled briefings are skipped when the outage is longer than one hour (the scheduler's misfire grace time is 3600 seconds).

## 1. Keep Marcus up

**Keep the Mac awake.** The wording differs by macOS version.
- Desktop Mac: System Settings, Energy, turn on the option that prevents automatic sleeping when the display is off.
- MacBook: System Settings, Battery, Options, turn on the option that prevents automatic sleeping on the power adapter when the display is off. Stay plugged in.
- Or hold it awake from Terminal: `caffeinate -s` (prevents system sleep while on power, for as long as it runs).
- A closed MacBook lid normally puts the Mac to sleep unless it is in clamshell mode (power adapter plus an external display and keyboard or mouse). Leave the lid open, or use a Mac that stays on.

**Start Docker at login.** Docker Desktop: Settings, General, start Docker Desktop when you sign in. OrbStack: Settings, start at login.

**Restart policy.** `postgres`, `whisper`, `kokoro`, `backend` and `frontend` all use `restart: unless-stopped`, so they come back when Docker comes back and after a crash. A container you stopped on purpose stays stopped.

**Belt and braces: start the stack at login.** `scripts/ops/start-stack.sh` waits for Docker to be ready (up to 5 minutes) and then runs `docker compose up -d`. To run it at every login:

```bash
cp scripts/ops/com.whink.marcus-stack.plist.example ~/Library/LaunchAgents/com.whink.marcus-stack.plist
# edit the file: replace REPLACE_WITH_REPO_PATH and REPLACE_WITH_HOME
launchctl load ~/Library/LaunchAgents/com.whink.marcus-stack.plist
```

**Check it is up.** `curl -s http://127.0.0.1:8002/health` returns `{"status":"ok",...}`. Through Tailscale: `https://<mac-name>.<tailnet>.ts.net/api/health`.

## 2. Backups

What is backed up: the whole `marcus` Postgres database (conversations, memory, tasks, approvals, briefings, settings). The dump is private data. `scripts/ops/db-backup.sh` writes it with mode 0600. The dump is **not encrypted at rest**: keep it on a FileVault disk, and encrypt it before it leaves the machine.

What is not in the dump, and must be kept separately (a password manager is fine): the values in `.env`: `POSTGRES_PASSWORD`, `API_KEY`, `APPROVAL_PIN`, `OMNIROUTE_API_KEY`, `ECHELON_API_KEY`. Marcus has no application encryption key, so a restore does not need one. It does need the `.env` values to start.

**One backup now**
```bash
scripts/ops/nightly-backup.sh            # writes ~/Backups/marcus/marcus-YYYY-MM-DD-HHMMSS.dump
```
The script never overwrites a dump, keeps the newest 14 (`KEEP=30 scripts/ops/nightly-backup.sh` changes that), and deletes older ones only after the new backup succeeded. A failed backup changes nothing in the folder.

**Every night at 02:30** (launchd runs a missed job when the Mac wakes):
```bash
cp scripts/ops/com.whink.marcus-backup.plist.example ~/Library/LaunchAgents/com.whink.marcus-backup.plist
# edit the file: replace REPLACE_WITH_REPO_PATH and REPLACE_WITH_HOME
launchctl load ~/Library/LaunchAgents/com.whink.marcus-backup.plist
```
Or with cron: `30 2 * * * /bin/bash /path/to/repo/scripts/ops/nightly-backup.sh >> ~/Library/Logs/marcus-backup.log 2>&1` (cron needs `docker` on its PATH).

**Off-machine copy.** The dumps above stay on the same Mac, so they do not survive losing the Mac. Where to copy them (an external disk, a cloud bucket, another machine) is Victor's decision, because it may cost money and puts private data elsewhere. Encrypt before copying. Nothing here copies off the machine.

## 3. Restore

Restore into a new database name, then swap it in. The old database is kept as `marcus_old`, so nothing is destroyed.

```bash
docker compose stop backend
C=$(docker compose ps -q postgres)
scripts/ops/db-restore.sh "$C" marcus_restored whink ~/Backups/marcus/marcus-YYYY-MM-DD-HHMMSS.dump
docker exec "$C" psql -U whink -d postgres -c 'ALTER DATABASE marcus RENAME TO marcus_old'
docker exec "$C" psql -U whink -d postgres -c 'ALTER DATABASE marcus_restored RENAME TO marcus'
docker compose up -d backend
curl -s http://127.0.0.1:8002/health
```

`db-restore.sh` refuses a target database that already has tables. Drop `marcus_old` only after you have checked the restored data.

## 4. Prove the restore works

`scripts/ops/test-restore.sh` starts a throwaway pgvector container, creates Marcus's real schema with the backend's own `init_db`, inserts 25 rows, backs up, restores into a second database, and compares the exact row count of every public table. It also checks that restoring into a populated database is refused. It needs Docker and the backend's Python dependencies. Use Python 3.11 (the image's version); the pinned versions may not install on newer Pythons.

```bash
python3.11 -m venv .venv && .venv/bin/pip install -r backend/requirements.txt
PYTHON=.venv/bin/python scripts/ops/test-restore.sh      # prints PASS: N tables, row counts identical after restore
```

`scripts/ops/test-ops-standin.sh` tests the same scripts without Docker, against a real local Postgres 16, through a stand-in `docker` command (`scripts/ops/standin/docker`). It needs root and the Postgres server binaries, so it is for development machines, not the Mac. It does not cover the pgvector image, the backend schema, or `docker compose`. Run the real drill on the Mac once, and again after any schema change.
