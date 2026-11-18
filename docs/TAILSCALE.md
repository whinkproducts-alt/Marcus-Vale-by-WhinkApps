# Marcus on iPhone / iPad over Tailscale (HTTPS)

iOS only allows the microphone on HTTPS. `tailscale serve` gives Marcus a real certificate on a private `*.ts.net` name and forwards to the existing `127.0.0.1:7000`. No Marcus code or compose change is needed: the app calls a relative `/api`, so everything stays on one origin.

## Setup (once, on the Mac that runs Marcus)

1. Install Tailscale on the Mac and on the iPhone/iPad. Sign both into the same tailnet.
2. In the Tailscale admin console, turn on **MagicDNS** and **HTTPS Certificates**.
3. Start Marcus: `docker compose up -d` (frontend listens on `127.0.0.1:7000`).
4. Publish it to your tailnet only:
   ```bash
   tailscale serve --bg --https=443 http://127.0.0.1:7000
   tailscale serve status
   ```
5. On the iPhone, open `https://<mac-name>.<tailnet>.ts.net` in Safari. Share, then **Add to Home Screen**.

To stop sharing: `tailscale serve --https=443 off`.

## Rules

- **Never use `tailscale funnel`.** Funnel puts Marcus on the public internet.
- **The nginx proxy adds the API key to every request it receives.** Anyone who can reach this URL has full access to Marcus without a key. Tailscale limits reach to your tailnet, so keep the tailnet to your own devices and add an ACL that allows only your phone, tablet and Mac to reach the Marcus machine. Do not share the node with other people.
- Do not publish port 8002 (backend) or any other Marcus port. Only the frontend on 7000 goes through `serve`.
- ECHELON is not exposed by this. Marcus reaches it from the Mac at `host.docker.internal:3000`.

## Check it works

- `https://<mac-name>.<tailnet>.ts.net/api/health` returns `{"status":"ok",...}`.
- Hold-to-talk asks for the microphone on the phone. If it does not, the page is not on HTTPS.
- From a device outside your tailnet the URL does not load.
