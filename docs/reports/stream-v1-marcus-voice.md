# Streaming voice replies, v1

## What is done

- `OMNIROUTE_VOICE_MODEL` (optional, empty means `OMNIROUTE_MODEL`) in `backend/config.py` and `.env.example`. Only the streaming voice route uses it.
- `services/omniroute.py: generate_stream` calls OmniRoute `/chat/completions` with `stream: true` and `stream_options.include_usage`, and yields text deltas. The budget is checked before the request. When the stream ends (or the caller stops early) cost is recorded through `spend.llm_cost` and `spend.record_cost`, from provider usage when present, else estimated.
- `services/sentences.py` turns deltas into whole sentences. It splits on `. ! ?` and newlines, not on decimals, common abbreviations (Mr., Dr., e.g.), single capital initials, or inside triple-backtick code. Sentences over 300 characters are cut at a comma or space. The remainder is flushed at the end.
- `POST /voice/chat/stream` (under the existing API key dependency) sends server-sent events `sentence` ({text}), then `done`. Kill phrase, resume phrase (replies that the PIN is needed, never unfreezes), time zone phrase, history, core facts and the never-store check match `/voice/chat`; the shared logic was moved into helpers used by both routes. A spend cap gives HTTP 402 and a model failure gives a generic 502, both before any bytes are sent. A failure mid-reply sends an `error` event with a generic message. The turn is saved only if neither side matches never-store. Auth, PIN and freeze code are untouched.
- Frontend: `App.tsx` reads the stream with fetch and ReadableStream, shows sentences in one growing chat bubble, starts Kokoro synthesis for each sentence as it arrives while earlier ones play, and plays through the single unlocked Audio element. Pressing hold-to-talk aborts the stream (AbortController), drops pending synthesis and stops playback.
- Tests: `tests/test_sentences.py` and `tests/test_voice_stream.py` (fake OmniRoute stream): event order, voice model choice, saved turn and cost row, 402, 502, freeze, resume does not unfreeze, never-store not saved, API key required. Backend suite: 113 passed. Frontend build passes.

## Try it on the Mac

1. OmniRoute running with streaming enabled for the chosen model, Kokoro and Whisper containers up (`docker compose up -d`).
2. Optional: set `OMNIROUTE_VOICE_MODEL` in `.env` to a fast model, restart the backend.
3. Open the app, hold the button, speak, release. Text should grow sentence by sentence and speech should begin after the first sentence. Press the button again mid-reply: speech and text should stop at once.
4. Say "Marcus, stop everything", then "Marcus, resume": it should freeze, then ask for the PIN.

## NOT verified

- Real latency. No timing was measured and none is claimed.
- Real audio: Kokoro output, gapless playback between sentences, iOS Safari and iPad behaviour, barge-in on a phone.
- A real OmniRoute stream (the usage chunk with `include_usage` may be rejected or ignored by some providers; then cost is estimated).
- The nginx path in `docker compose` (the response sets `X-Accel-Buffering: no`; not run through nginx).
- Frontend has no tests; the stream parser and abort logic were only built, not exercised in a browser.
- Client abort while the saving step runs in the server's `finally`: a partial reply could be saved if it passes never-store. Not tested.
