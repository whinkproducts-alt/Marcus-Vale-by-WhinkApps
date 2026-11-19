# Stream m6: Marcus alert pings (WhatsApp, Telegram, email)

## What is built

- `backend/services/notify.py`: `ping(kind)` sends a fixed text to every channel that is configured and enabled. Briefing: "New briefing from Marcus". Alert (blocked task, second approval needed, spend cap): "Marcus needs you". No task titles, goals, results, names, amounts or briefing text ever go out, because sending content outside the account is a protected action and a generic ping is not. Outbound only, no tools, no replies.
- Channels: Telegram (Bot API sendMessage), WhatsApp (Twilio Messages API, basic auth), email (smtplib STARTTLS in a thread). 10 second timeouts. Each ping id (briefing id or alert key) sends once per process.
- A failing channel is caught, the others still send, and only the exception class name and channel are logged. Briefings, the scheduler and the ECHELON listener never see an error.
- Choice of channels: settings key `alert_channels` (default empty, nothing sent). `GET /settings/alert-channels` returns `{configured, enabled}` per channel, never a secret. `PUT /settings/alert-channels` needs the approval PIN (403 wrong or missing, 429 locked), rejects unknown names and unconfigured channels with 400.
- Hooks: scheduler `_job` after a briefing is stored, and the two `_alert_once` helpers (echelon_events, spend) only when a new alert row is written. Stored data is unchanged.
- Settings screen: "Alerts" block with three checkboxes, PIN field held in memory only, Save, clear errors for 400, 403, 429.
- Tests: `backend/tests/test_notify.py` (fixed text with a task titled SECRET-TITLE in the DB, off when unconfigured or not enabled, failure isolation, no secret in logs, dedupe, PIN required, unknown 400, unconfigured 400).

## How Victor turns a channel on

Put the secrets in `.env` (compose passes them through), then restart the backend, then tick the channel in Settings > Alerts and enter the approval PIN.

- Telegram: create a bot with @BotFather and copy the token into `TELEGRAM_BOT_TOKEN`. Send the bot any message, then open `https://api.telegram.org/bot<TOKEN>/getUpdates` and read `message.chat.id` into `TELEGRAM_CHAT_ID`.
- WhatsApp (Twilio): `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` (sender number, written without the `whatsapp:` prefix; the code adds it), `ALERT_WHATSAPP_TO` (your number, same format). The Twilio sandbox number works for testing, but you must first join it by sending the sandbox join code from your phone, and the sandbox session lapses after 24 hours of silence. A production sender needs an approved WhatsApp Business sender and, for a first message outside a 24 hour window, an approved template. A free-text ping may be refused outside the window.
- Email: `SMTP_HOST`, `SMTP_PORT` (587, STARTTLS), `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `ALERT_EMAIL_TO`.

## NOT verified

No real delivery was possible here: no Telegram, Twilio or SMTP call was made, all tests mock httpx and smtplib. Twilio WhatsApp template and 24 hour window behaviour, real SMTP servers, the frontend block on a phone (build only, no frontend tests). Dedupe is in memory, so a backend restart may repeat one ping.
