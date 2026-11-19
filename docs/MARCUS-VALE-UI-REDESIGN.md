# Marcus Vale | Full UI redesign

Date: 2026-11-18
Design branch: `design/scrollcraft-marcus-full-ui`
Design source: Scroll Craft, installed at `.agents/skills/scroll-craft/`
Scope: All five existing frontend routes; backend unchanged.

## Brief

Marcus Vale is a private, voice-first executive assistant to Victor Igboekwe. The experience should feel calm, deliberate, highly competent, and premium, while keeping sensitive operations and approval boundaries clear.

**Design concept:** An executive workspace in midnight navy, warm metallic gold and quiet electric blue, inspired by WHINK Apps' real gold/blue logo. The new orbital M symbol distinguishes Marcus Vale from both the corporate WHINK Group logo and the subsidiary WHINK Apps logo.

**Journey:** Open a personal conversation; record a voice request; review and approve tasks; read briefings; inspect memory; control spending, alerts and integrations.

**Scroll Craft adaptation:** This is a functional app, not a long marketing landing page. Use the skill's design standards (independent depth planes in the conversation hero, typography, color roles, varied rhythm, meaningful transitions, mobile-specific composition, reduced-motion support). Deliberately do **not** add video scrubbing, aggressive pinning or decorative scroll sequences to repetitive operational workflows.

**Emotional sequence:** Welcome → Focus → Control → Clarity → Reassurance.
**Primary moment:** Marcus' actual portrait emerges from the dimensional conversation hero, alongside a direct voice action. **Signature move:** the orbital M identity is carried from app icon through desktop navigation and hero, while the portrait and content occupy separate depth planes.
**Creative direction:** Self-authored from the product and brand material; user requested a complete redesign without specifying additional style constraints.

## Existing functions kept

- Voice input, microphone hold/release, barge-in and streaming speech
- Task creation, pending approvals, second confirmations, ECHELON handoff and freeze/resume
- Actual briefing read states
- Memory search and three persistence layers
- Spending status, configurable alert channels, PIN-gated saves

The app must never invent connected status, task completion, user history or spend metrics. External service health is not asserted without API verification.

## Authentic visual sources

Source-of-truth repository: [ECHELON-INTEGRATIONS](https://github.com/whinkproducts-alt/ECHELON-INTEGRATIONS).

- Official Marcus Vale portrait: `apps/web/public/board/marcus-vale.webp`
- Verified WHINK Apps logo: `apps/web/public/assets/official/subsidiaries/whink-apps.webp`
- Verified WHINK Group logo: `apps/web/public/assets/official/brand/whink-group.webp`
- Original Marcus Vale app mark: `frontend/public/marcus-mark.svg`

The first three remain separate, unmodified assets. The current UI loads them from the organization's public repository. This requires a network connection for imagery; the UI uses a monogram fallback if Marcus' portrait is unavailable. Before fully offline deployment, mirror and checksum-verify the source images into an approved static asset pipeline. Do not replace the authentic portrait with an AI lookalike.

## Quality checks

- `cd frontend && npm ci && npm run typecheck && npm run build`
- Check desktop 1440px, tablet 820px, iPhone width 375px
- Verify keyboard navigation, accessible labels, contrast and reduced-motion preference
- Verify **hold-to-talk** and interruption on iOS Safari (requires backend/HTTPS)
- Verify approval PIN never leaves component memory except in the request header
- Verify the existing API responses in Task, Briefing, Memory and Settings screens
- Verify image loading and offline fallback
- No migrations and no backend changes in this PR

## Scroll Craft security notes

Installed only checked-in source files from the user's public repository. Static inspection of scripts found expected local filesystem/process operations and an optional `scripts/kie.mjs` external asset-generation client. That script sends API-key-authenticated requests to `api.kie.ai` and `kieai.redpandaai.co` **if explicitly executed**. This redesign did not execute those calls or provide a credential. No full dependency audit or dynamic sandbox execution of the skill has been completed. Its engine is vendored for availability but is not imported into the task app at runtime.
