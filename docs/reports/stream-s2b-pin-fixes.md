# Stream S2b: fixes for the independent PIN review

Scope: the findings of the security review of the Marcus PIN change (S2 backend, S1 frontend). Backend work is on branch `stream/s2-marcus-api`; the frontend fix is on `stream/s1-marcus-ui`. Nothing was pushed.

## Results

| Finding | Status | Evidence |
|---|---|---|
| H1 spoken "Marcus, resume" unfreezes with no PIN | Done | `routes/voice.py` no longer calls `do_resume`; chat answers "Resume needs your PIN. Open the app, enter your PIN and tap Resume." Test `test_spoken_resume_does_not_unfreeze_and_the_pin_route_does` freezes, sends the bare phrase and a long sentence containing it, checks Marcus stays frozen and ECHELON gets no unfreeze call, then resumes through `/control/resume` with the PIN. Reverting the fix makes it fail. |
| H2 no limit on PIN guesses | Done | `services/auth.py`: five wrong PINs lock every attempt, the right PIN included, for 15 minutes. Logs only "approval pin failure n". Minimum PIN length is now 8. Tests: lockout, lock expiry, a right PIN resets the count, a missing header is never counted, no PIN value in the log. Reverting the limit makes the lockout test fail. |
| H3 compose does not pass `APPROVAL_PIN` | Already fixed elsewhere, not touched here | `docker-compose.yml` is owned by S3. `git -C /home/user/wt/s3-marcus-ops show HEAD:docker-compose.yml` has the line `APPROVAL_PIN: ${APPROVAL_PIN:?set APPROVAL_PIN in .env}`. It only takes effect once S3 is merged with S2. |
| M1 frontend keeps the PIN for the whole tab | Done | `TaskList.tsx` clears the PIN after a successful approve (which also covers the second-approval path) and after a successful resume. Checked in a real browser against a mocked API: the PIN went out as `X-Approval-Pin`, the field was empty afterwards, nothing in localStorage or cookies. The resume half was not exercised in the browser (the button did not render in my mocked state); it is the same one-line change and builds. |
| M2 `/echelon/resume` takes a note with no PIN | Done | `routes/echelon.py` `resume_blocked` now depends on `require_approval_pin`. Test sends the note with no PIN and a wrong PIN, checks 403 and that nothing reached ECHELON, then succeeds with the PIN. The UI has no control for answering a blocked task, so no frontend change was needed or built. |
| M3 rejected PIN printed in the startup error | Done | `hide_input_in_errors=True` in `config.py`. Test checks a 7-character PIN and two other secrets are absent from the error text. Reverting makes it fail. |
| M4 poll-first ordering swallows alerts | Done | `services/echelon_events.py`: an event with an id always counts; without an id only a real status change counts. The event id in the key plus `_alert_once` still stops replays. Test writes the status as a poll would, then applies the event: one alert; replayed event: still one; no-id event with no change: still one. |
| M5 two simultaneous taps both reach ECHELON | Done | `routes/echelon.py`: `_claim` does `UPDATE approvals SET used=true WHERE id=:id AND used=false` and needs one row before ECHELON is called; `_release` gives the approval back if ECHELON refuses or fails. Test sends two handoffs with `asyncio.gather` against a fake ECHELON: one 200, one 409, one send. A second test checks a refused send releases the approval so a retry works. The unique index stays as a backstop. Beyond the brief, `confirm_handoff` has the same race and uses the same two helpers. |
| M6 approvals from before the PIN are still usable | Done | `services/approval_retire.py` runs once at startup (flag `approvals_pre_pin_retired` in the settings store) and sets every unused approval to used. Test: an old unused approval is retired once, an approval made afterwards is untouched by the next startup. |
| L1 `POST /approvals/{id}/approve` has no purpose | Done | Route deleted. Nothing in the backend, the S1 frontend, S3 scripts or the CORP scripts calls it. Test checks it answers 404 or 405. |
| L2 duplicate rows silently skip the unique index | Done | `database.py` now logs at error level with the remedy. Not covered by a test (the statement is Postgres only). |
| L3 `compare_digest` returns early on different lengths | Not done | Leaks only the PIN length. |
| L4 uvicorn and python-dotenv pin combination untested | Not done | The 3.11 run below uses the exact pins; no other combination was tried. |
| L5 alert key column is 120 characters | Not done | Unlikely with UUID ids. |
| L6 time zone by voice needs no PIN | Not done | Outside the contract and low impact. |

## Numbers

- Backend tests: 93 pass (84 before, minus the deleted approvals-approve test, plus 10 new). Python 3.11 with the exact pinned `requirements.txt`: 93 pass. Python 3.13 with unpinned dependencies: 93 pass.
- `pip-audit` on the pinned lines: no known vulnerabilities.
- Frontend: `npm ci` and `npm run build` pass.
- Mutation checks (each fix broken on purpose, tests must fail): no lockout, spoken resume restored, no atomic claim, old alert guard, error input shown. All five failed the new tests.

## Decisions for the user

1. H1 is the fail-closed default. The README feature "Marcus, resume" no longer resumes. Say if you want a spoken resume back; it cannot carry the PIN, so it would have to be a weaker control.
2. The lockout is global to the process because nginx hides client addresses. An attacker who can reach the proxy can lock Victor out for 15 minutes by guessing wrongly. That is the price of the limit.

## Not verified

- Real Postgres, `asyncpg` and `pgvector`: the Postgres-only index statement and the claim `UPDATE` ran on SQLite in tests only.
- Docker image build, the non-root user at runtime, `docker compose up`.
- The claim happens before ECHELON is called, so a crash between the claim and the send leaves the approval used and the user must approve again. This fails closed. ECHELON's own idempotency on `client_operation_id` was not checked.
- Anything on a phone or the Mac.
- Files outside this stream's ownership still say the old things: `docs/KICKOFF-2026-11-18.md` (minimum 6 characters, spoken resume) and the original spec `marcus-vale-build.md`.

## How to verify each fix (for the re-review)

- H1: `cd backend && python -m pytest -q tests/test_pin_and_handoff.py -k spoken`. By hand: freeze, then `POST /voice/chat` with "Marcus, resume": the status stays frozen and the reply mentions the PIN.
- H2: `-k lock` and `-k resets`. Set `services.auth._locked_until` to the past to simulate the 15 minutes.
- H3: look at S3's `docker-compose.yml` after merging S3 with S2.
- M1: in `frontend/src/components/TaskList.tsx`, `setPin('')` follows the success of `approve` and `resume`.
- M2: `-k answer_to_a_blocked`. M3: `-k rejected_setting`. M4: `-k poll`. M5: `-k simultaneous` and `-k refused_send`. M6: `-k retired_once`. L1: `-k approve_route_is_gone`.
