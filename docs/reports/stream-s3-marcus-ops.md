# Stream S3 (marcus-ops) report, 2026-11-18

Branch `stream/s3-marcus-ops`, based on `claude/awesome-clarke-q7gqaw` at f288281. Owned paths only: `scripts/**`, `docs/**`, `docker-compose.yml`. Nothing pushed.

## Items

| Item | Status | Evidence |
|---|---|---|
| a. `APPROVAL_PIN` required in compose backend environment | Done | `docker compose config` exits 0 with dummy env; without `APPROVAL_PIN` it errors "required variable APPROVAL_PIN is missing a value" |
| a2. (added) `restart: unless-stopped` on `backend` and `frontend` | Done | Only `postgres`, `whisper`, `kokoro` had it. Without it Marcus itself did not return after a Docker or Mac restart or a crash. Compose validates. |
| b. Nightly backup script, keep 14, never overwrites | Done in script, tested | `scripts/ops/nightly-backup.sh`; stand-in test: 5 old dumps plus one new with `KEEP=3` leaves exactly 3, newest is a valid `pg_restore -l` archive; a failed backup prunes nothing and leaves no `.partial`; `KEEP=0` refused |
| b. launchd example plists (backup 02:30, stack at login) and cron line | Done, not installed | Both parse with Python `plistlib`; cron line is in `docs/OPERATIONS.md`. `plutil -lint` not run (not macOS). |
| b. Restore drill `scripts/ops/test-restore.sh` | Written; logic proven on real Postgres | Adapted from ECHELON-INTEGRATIONS `test-restore.sh`. Stand-in run: PASS, 11 tables identical, restore into a populated database refused |
| b2. `scripts/ops/start-stack.sh` (wait for Docker, then `compose up -d`) | Done, tested | Stand-in: runs `compose up -d`; exits 1 when Docker never comes up |
| c. `docs/OPERATIONS.md` (awake, Docker at login, backups, off-machine copy, restore, drill) | Done | The restore swap commands in the doc were run in the stand-in test: `marcus` held the 25 backed-up rows, `marcus_old` kept the emptied data |
| d. `docs/TAILSCALE.md`: ACL snippet, never `funnel`, PIN protects approvals | Done | Doc only. The ACL JSON was not run against a tailnet. |
| e. `bash -n`, executable bits, shellcheck | `bash -n` and bits done; shellcheck not run | shellcheck is not installed here |

## How it was tested

`scripts/ops/test-ops-standin.sh` runs the real scripts against a real local Postgres 16 (real `pg_dump`, `pg_restore`, `psql`) through a stand-in `docker` command (`scripts/ops/standin/docker`). The stand-in swaps only the `CREATE EXTENSION ... vector` statement for `SELECT 1`, because this Postgres has no pgvector. Seven checks, all pass.

## NOT verified (only runs on the Mac)

- The pgvector image and `CREATE EXTENSION vector` for real.
- The backend's own schema through `init_db` (the drill's default schema step). The stand-in used simple tables with the real table names. Run `scripts/ops/test-restore.sh` once on a Docker host.
- `docker compose up` for the full stack, `docker compose ps -q postgres` against a real compose project, and the launchd and cron jobs themselves.
- `docker exec` argument handling by the real Docker CLI (the stand-in mimics the forms the scripts use).
- The Tailscale ACL, Docker or OrbStack start-at-login menu names, and the macOS sleep settings wording. These are written from general knowledge, and their wording changes between versions.
- shellcheck.

## Notes for other streams and the lead

- S2 owns `.env.example`. It must add `APPROVAL_PIN=` there so the `.env` template matches the compose requirement.
- Compose now fails to start without `APPROVAL_PIN` in `.env`. Victor must set it before the next `docker compose up`.
- `scripts/ops/db-backup.sh` (grabbed from INTEGRATIONS) leaves an empty `.partial` file when `pg_dump` itself fails. I did not change that file; `nightly-backup.sh` removes the partial on exit.
- Off-machine backup destination and encryption choice are Victor's decisions.
