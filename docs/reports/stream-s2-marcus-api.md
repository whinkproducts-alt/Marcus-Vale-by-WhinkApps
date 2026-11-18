# Stream S2 (marcus-api): report, 2026-11-18

Branch `stream/s2-marcus-api`, built on `claude/awesome-clarke-q7gqaw` (f288281). Builder only: the PIN code needs an independent security review before it is trusted (see "For the lead").

## Items

| Item | Status | Evidence |
|---|---|---|
| a. Approval PIN | Done, unreviewed | `services/auth.py` `require_approval_pin` (constant-time compare, fails closed when no PIN is set) on `POST /tasks/{id}/approve`, `POST /approvals/{id}/approve`, `POST /control/resume`. `/control/freeze` needs none. Wrong or missing gives 403 `{"detail":"approval pin required"}`. Startup refuses when ECHELON is on and the PIN is missing, and always refuses a PIN under 6 characters. `.env.example` has `APPROVAL_PIN=`. Tests: refusal creates no approval row, freeze works without a PIN, resume stays frozen after a bad PIN, unset PIN fails closed. Checked on real HTTP with uvicorn: 401 without the API key, 403 without or with a wrong PIN. |
| b. Delete `POST /approvals/` | Done | Route and `ApprovalCreate` removed; a test confirms 404 or 405. Only the deleted root `tests/` called it. |
| c. False capability claims | Done | `services/omniroute.py`: removed the COMMUNICATION section (calls, voicemail, WhatsApp), removed "scheduling lookups, reminders" from Lane 1, and added a "WHAT YOU CAN DO" section that says plainly what Marcus cannot do. `services/freeze.py`: no more "calls and reminders keep working". `services/lane_router.py`: removed "setting a reminder". Left as is: "researching" (model knowledge only) in the Lane 1 examples. |
| d. Dependencies | Done, goes beyond a plain bump | See below. |
| e. Price warning | Done | `config.warn_if_prices_unset` logs a warning at startup when `OMNIROUTE_MODEL` is not `gpt-4o-mini` and any `OMNIROUTE_PRICE_*` variable is unset. Test covers warn, no warn on default model, no warn when all three are set. |
| f. Unique handoff per approval | Done | Index `uq_echelon_handoffs_approval_id` on `echelon_handoffs.approval_id` (declared in the model so fresh databases get it, and as an idempotent statement for old ones). The statement runs in its own transaction with a logged warning on failure, so an old database that already holds duplicates still starts. A second insert returns 409. Test simulates a second tap racing past the checks. |
| g. Repeat alerts | Done | Alert key now includes the feed event id, and an alert fires only on a transition into `blocked` or `reconfirmation_required`, so a replayed event does not alert again. Test: block, resume, block, replay gives exactly 2 alerts. |
| h. Trust code | Done | `services/trust.py`, the `ActionTrust` model, both callers and the two trust tests deleted. `requires_approval` stays in the task response (always `true`) so the UI contract is unchanged. |
| i. Cleanup | Done | Root `tests/` (6 files) and `backend/debug_test.py` deleted. README auth row fixed, PIN and test steps documented. Backend Dockerfile runs as a non-root `app` user. `GET /tasks/` and `GET /memory/` take `limit` (default 200, max 500) and sort newest first. |
| j. Tests | Done | 84 pass (75 baseline, minus 2 deleted trust tests, plus 11 new). |

## Dependencies: before and after

- Before (`pip-audit` on the pinned lines): 21 advisories in 4 packages (`python-multipart` 16, `pytest` 2, `python-dotenv` 2, `fastapi` 1).
- After: `pip-audit` finds no known vulnerabilities on the pinned lines and on the whole resolved environment (`pip-audit -l`), dev tools included.
- `python-multipart` removed (no route uses `Form` or `File`). `pytest` and `pytest-asyncio` moved to `backend/requirements-dev.txt` (which includes `requirements.txt`).
- New pins: `fastapi 0.164.0`, `pydantic 2.14.3`, `pydantic-settings 2.16.3`, `python-dotenv 1.2.2`, `typing_extensions 4.16.0`; dev `pytest 9.2.0`, `pytest-asyncio 1.5.0`. This is more than "bump fastapi": FastAPI 0.115 (the first line that passed) capped Starlette below its fixed versions and the audit still showed Starlette advisories. Only the newest line cleared them, and it needs a newer Pydantic and `typing_extensions`.
- Everything above was installed fresh from the files on Python 3.11 (the production image's Python) and the suite was run there.

## Not verified

- Real Postgres, `asyncpg`, `pgvector` and the `init_db` index statement. No Docker in this environment. The SQLite test database does not run the Postgres-only `_PG_ALTERS` or `_PG_OPTIONAL` statements.
- The Docker image build and the non-root user at runtime (file permissions for the `app` user).
- A real browser or the React app calling the PIN-protected routes (frontend is stream S1; the contract is `X-Approval-Pin`).
- Behavior under real load, and `uvicorn 0.24.0` with a real database (served over real HTTP with the database and scheduler stubbed).

## For the lead

1. **PIN bypass in voice chat (decision needed).** `POST /voice/chat` still resumes work on the phrase "Marcus, resume" with no PIN, which is the old documented spoken feature. That path lifts a freeze without the PIN, so a stolen device can unfreeze Marcus by chat. I left it alone because the contract names only the three routes and changing it changes a user-facing feature. Options: require the PIN header on `/voice/chat` for the resume phrase only, or drop the spoken resume. Freeze by voice is meant to stay open.
2. Independent review of `services/auth.py`, `config.py` validators and the three gated routes (rule 9: builders do not grade their own work).
3. Existing deployments: set `APPROVAL_PIN` in `.env` and add it to the backend environment in `docker-compose.yml` (stream S3 owns that file) before restarting, or Marcus will not start when ECHELON is on.
4. `aiosqlite` stays in the production requirements. It is only used by tests and the SQLite fallback; moving it is a separate small change.
5. Two backend files outside my plan were touched only as the plan required: `models.py` (index, trust model removed) and `database.py` (optional index statement).
