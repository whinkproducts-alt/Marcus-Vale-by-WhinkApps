# Stream S1: Marcus UI (2026-11-18)

Branch `stream/s1-marcus-ui`, based on `claude/awesome-clarke-q7gqaw` (f288281). Files changed: `frontend/**` only. Not pushed.

## Items

| Item | Status | Evidence |
|---|---|---|
| M1a TaskList: Approve with PIN, Send to ECHELON, status and result, second-approval card, Freeze and Resume | Done | Browser test with a mocked API (see below): 9 real checks pass. API calls seen match the backend routes: `POST /tasks/{id}/approve?method=tap` with `X-Approval-Pin`, `POST /echelon/handoff` and `/echelon/confirm` with `task_id` and `approval_id` query parameters, `POST /control/freeze` with no PIN, `POST /control/resume` with the PIN, `GET /echelon/status/{id}`, `GET /control/status`. |
| M1a PIN kept in memory only | Done | Test confirms the PIN is not in localStorage or cookies after use. Approval ids (not secret) are kept in sessionStorage so a reload does not strand an approved task. |
| M1a result_summary as plain text | Done | Test: a summary containing an `<img onerror>` string is shown as text and the handler never runs. |
| M1b Hold-to-talk: pointer events, grabbed helpers wired, one recorder at a time, early release still stops | Done on desktop Chromium with a fake microphone | The same 8-check test fails 5 of 8 against the original code (microphone left live, stuck on "Listening", two microphone requests) and passes 8 of 8 on this branch. |
| M1c CSS: touch-callout, user-select, touch-action, 100dvh, safe-area, viewport-fit=cover | Done in code | Build passes. NOT verified on a device. |
| M1d Audio unlock: one Audio element created and played silent inside the press, reused for the reply | Done in code | Build passes. NOT verified on a device. |
| M1e Build-only packages to devDependencies; npm audit before and after | Done, vite bump not done | Runtime-only audit (`npm audit --omit=dev`) went from 8 findings to 2 (both `react-router`, moderate). Full audit is unchanged at 8 (1 high, 7 moderate), all dev-time except react-router. Vite is already on the latest 5.x (5.4.21); the fix for the high finding is a major jump to vite 8 and vite-plugin-pwa 2, which was not attempted. `npm audit fix` without force changed nothing and was reverted. |

## Verification run

- `npm ci` then `npm run build`: passes after the dependency move.
- Ad-hoc strict `tsc --noEmit` on the changed files: 0 errors (the repo has no tsconfig, so Vite itself does not typecheck).
- Browser test of the task controls and of the microphone race: run against the built app served by `vite preview` in Playwright Chromium. The scripts were scratch files and are not committed (no test framework was added, per the brief).

## Known limits

- A press that lands while a microphone permission request is still unanswered is ignored (this is what prevents two recorders). Impact: only the first-ever press, while the permission prompt is open.
- The PIN is lost on page reload by design; the user types it again.
- Approvals made in another tab or before this change have no id in this tab's sessionStorage; the backend refuses a second approve with "already has an unused approval". There is no list route to recover the id.
- Marcus `POST /echelon/resume` (answer a blocked task) has no button: not in the brief.

## NOT verified

- Everything on iPhone and iPad: audio unlock, the long-press menu, safe-area layout, `audio/mp4` recording through the backend, pointer capture.
- The PIN check itself: it is the backend stream's job (S2). Until S2 merges, the header is sent and the current backend ignores it.
- Any run against the real backend, a real ECHELON, or a real microphone.
- npm audit state of a Docker image build.

## Needs the lead or Victor

- Merge order: S2 before S1 (the PIN contract), as planned.
- S1 did not change `backend/**`, so `APPROVAL_PIN` and the 403 behavior must come from S2.
