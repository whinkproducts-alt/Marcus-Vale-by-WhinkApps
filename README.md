# Marcosville

## Summary

**Marcosville** is a new standalone iOS/Android executive-assistant application owned by Marcus Vale (Founder‑private AI executive assistant reporting only to Founder Victor).

- **Scope**: Independent implementation, zero ECHELON‑CORP dependencies (reference only).
- **Design**: Native SwiftUI (iOS) and Jetpack Compose (Android) clients; new TypeScript modular‑monolith backend with Fastify, PostgreSQL + pgvector, one authoritative durable scheduler, OIDC issuer and modular adapters.
- **Policy**: Preserved A/B/C approval model with exact 30‑second TTL; protected money/disclosure cannot be downgraded. 30‑specialist org, not 30 ECHELON identities.
- **Build**: Ordered phases P0–P7; verified deliverables, no auto‑deploy/send/spend.

## Repository Boundary

Created in this new repo `Marcosville`. All development respects zero mutation of ECHELON‑CORP (`whinkproducts‑alt/ECHELON‑CORP`). Reference commit: `bcdd0caa18201cf1c0e09adc71aef7855365f495`.

## Getting Started (Dev)

```bash
# This workspace uses pnpm workspaces with local node_modules (shallow hoisted)
cd marcosville
pnpm install    # installs fastify, prisma, and other build tools
pnpm build      # placeholder; replace with real build scripts later
pnpm test       # placeholder; replace with real tests
```

### Directory Overview

```
marcosville/
├── packages/
│   ├── domain/            # domain models & interfaces
│   ├── database/         # Prisma schema, DB runtime
│   ├── adapters/         # external connectors (mail, calendar, etc.)
│   └── evaluations/      # independent review workflows
├── apps/
│   ├── api/              # Fastify HTTP server
│   ├── ios/              # SwiftUI iOS client
│   ├── android/          # Jetpack Compose Android client
│   └── worker/           # durable job executor & scheduler
├── infra/                 # container manifests, scripts, CI templates
├── docs/                  # ADR, canon, evidence, operations
└── tests/acceptance/     # end‑to‑end verification scripts
```

## Domain Model Highlights (Proposed)

- **User** (owner, identity, device enrollment)
- **PersonaState` (MARCUS persona version, canonical facts, style)
- **Conversation/Message` (client operation IDs, scoped to owner)
- **Task/ExecutionPlan/Job` (sealed mission, fenced attempts, checkpoints)
- **ApprovalRequest/Action` (request‑ID / content‑hash, one‑use 30‑sec TTL)
- **Memory` (compartments: canon, founder profile, private episodic/semantic/procedural, working TTL)
- **Connector/Connection` (provider state, consent, credential reference, webhook cursor)
- **ExternalOperation` (provider‑executed action, receipt, idempotency)
- **Operation` (admitted model or speech via ModelPort/SpeechPort)
- **Routine/Briefing/Notification` (scheduled, user‑preferences)
- **SafetyEpochLock` (server‑persisted lockdown, cancellation)

## Acceptance Gates (P0‑P7)

| Phase | Goal | Deliverables |
|-------|------|--------------|
| **P0` | Repo boundary & readiness | `marcosville/` repo with git history, canon/conflicts docs, ADRs, simple README + .gitignore + pnpm setup. |
| **P1` | Backend foundation | Fastify API skeleton, Prisma schema (new DB), domain packages, policy/approval/safety/budget foundation, real tests. |
| **P2` | Real vertical slice (text) | Sign‑in, task/draft/chat, one‑winner multi‑device approval, event/pull sync, offline drafts, decision inbox, device sessions. |
| **P3` | Hosted runtime | Source‑based routines/briefing, foreground voice state machine (IDLE→LISTENING→...→IDLE), degraded behavior, no Mac‑only assumption. |
| **P4` | Real connectors | Mail/calendar first, then SMS/messaging/inbound/reconcile, two‑way call/media, explicit iMessage unavailability. |
| **P5` | Vehicle surfaces | Eligible CarPlay/Android Auto (entitlements/category/track), real device tests, truthful unsupported status. |
| **P6` | Security/hardening | A11y/performance/battery hardening, export/delete/isolated restore, physical Mac‑off test, 72‑hour soak, worker crash fencing. |
| **P7` | Release & handoff | Signed installable packages, reproducible CI, ops/recovery, Founder‑approved release decision (no auto‑deploy). |

## Process

- **All code is built in a single shared workspace.**
- **High‑trust lead architect/lead (this session) produces focused changes; independent reviewers (agents 25‑29) give precise findings; builder fixes; reviewer verifies.**
- **Verification artifacts are committed as evidence.**
- **No auto‑deployment, send, spend, or publish without explicit Founder authorization.**

## Next Steps

Assuming Founder approval to proceed, the next ordered phase (P1) will produce the backend foundation described above. PRs should be opened against the main branch after each verified phase.

---

*Generated per the Marcosville execution prompt. No ECHELON code is imported or used.*
