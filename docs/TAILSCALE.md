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
- **The nginx proxy adds the API key to every request it receives.** Anyone who can reach this URL can read and use Marcus without a key. Tailscale limits reach to your tailnet, so keep the tailnet to your own devices and apply the ACL below. Do not share the node with other people.
- **The approval PIN is what protects approvals.** Approving a task, approving an approval, and Resume require the header `X-Approval-Pin` to match `APPROVAL_PIN` in `.env` (Freeze does not, so the kill switch stays one tap). The PIN is typed on the phone and is never added by nginx. This is enforced by the backend change in the approval-PIN work (stream S2). Until that is merged, only the ACL protects approvals. Compose refuses to start without `APPROVAL_PIN` set.
- Do not publish port 8002 (backend) or any other Marcus port. Only the frontend on 7000 goes through `serve`.
- ECHELON is not exposed by this. Marcus reaches it from the Mac at `host.docker.internal:3000`.

## Limit access to your own devices (ACL)

By default a tailnet lets every device reach every other device. In the Tailscale admin console, open **Access controls** and replace the allow-all rule (`"src": ["*"], "dst": ["*:*"]`) with a rule that lets each person reach only their own devices:

```json
{
  "acls": [
    {
      "action": "accept",
      "src": ["autogroup:member"],
      "dst": ["autogroup:self:*"]
    }
  ]
}
```

`autogroup:self` means the same user's own devices, so other users in the tailnet and any shared-in devices cannot reach the Marcus Mac. Leave the Marcus Mac untagged: tagged devices are not part of `autogroup:self`. To narrow it further, replace `autogroup:self:*` with `autogroup:self:443` (only HTTPS); that also blocks other traffic between your own devices, such as an SSH tunnel to a second machine's Ollama (see `HARDWARE_SETUP.md` in the ECHELON repo). Use the policy editor's preview and tests before saving. This was written without access to a tailnet, so it has not been run.

## Check it works

- `https://<mac-name>.<tailnet>.ts.net/api/health` returns `{"status":"ok",...}`.
- Hold-to-talk asks for the microphone on the phone. If it does not, the page is not on HTTPS.
- From a device outside your tailnet the URL does not load.
