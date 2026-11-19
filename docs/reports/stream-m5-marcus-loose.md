# Stream m5: Marcus loose ends

## Done
1. PIN lockout: `require_approval_pin` answers 429 "approval pin locked" while locked; wrong PIN outside lockout stays 403. TaskList shows "PIN locked, restart the backend or wait 15 minutes." for 429. docs/TAILSCALE.md updated. Test: `test_five_wrong_pins_lock_out_even_the_right_pin` (fails when reverted).
2. Stale approval id: TaskList `send` drops the stored id from state and sessionStorage on 400 or 409, so Approve shows again.
3. `.env.example`: APPROVAL_PIN wording says compose requires it even with ECHELON off.
4. Timeout guard: `create_handoff` keeps the approval spent on ReadTimeout or WriteTimeout and returns 502 telling Victor to check task status first. Connect and pool timeouts and all other errors still release. Test: `test_timeout_keeps_approval_spent_and_says_check_first` (fails when reverted).
5. Voice stream: partial reply is saved only after a clean finish (and still only if never_store passes). Test: `test_aborted_stream_not_persisted` (fails when reverted).

## Gates
Backend pytest: 115 passed (113 plus 2 new; the lockout test was changed, the abort test is new). Frontend `npm ci && npm run build`: see final reply.

## NOT verified
- Frontend fixes 1 and 2 have no automated test (the repo has no frontend test setup); only the build checks them.
- Abort test simulates a dropped stream with a generator exit, not a real client disconnect through nginx.
- Other read errors (ReadError, RemoteProtocolError) still release the approval; only timeouts hold it.
