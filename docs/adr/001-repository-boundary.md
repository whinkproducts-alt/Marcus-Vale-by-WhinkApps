# ADR 001 — Repository Boundary

## Context / Problem Statement

This new repository, `Marcosville`, must be created completely independent of ECHELON-CORP (`whinkproducts-alt/ECHELON-CORP`). The Founder (Victor) has explicitly directed that ECHELON is read‑only reference material for understanding Marcus Vale. No ECHELON code, data, secrets, accounts, runtimes, organization registry, or CI/CD may be imported, depended on, migrated, or transplanted into Marcosville.

## Decision

1. **New repository named exactly `Marcosville`** — private preferred, initialized fresh with no prior history.
2. **ECHELON-CORP inspected commit `bcdd0caa18201cf1c0e09adc71aef7855365f495` is reference only.** Source links in design documents use that immutable snapshot, not drifting `main`. No working copies, databases, configuration, accounts, credentials, or runtimes of ECHELON may be touched.
3. **All Marcosville code, schema, secrets, infrastructure, and CI/CD are independently developed.** Any later selective reuse of ECHELON source/assets requires a separate explicit scope, ownership/license verification and clean review; it is not assumed by this build.
4. **Repository remote/owner established from the current authenticated account and user context;** never created under an invented owner or to overwrite an unrelated repository.

## Consequences

- Marcosville owns its own repository, app identifiers, backend, OIDC identity, Founder account, device sessions, PostgreSQL/pgvector database, secrets, encryption keys, memory, workers, provider connections, infrastructure and CI/CD.
- "Same credentials on at least three devices" means the same Marcosville account, not shared tokens and not an ECHELON account migration.
- Marcosville is the app/repository name; source‑evidenced assistant identity is Marcus Vale.
- No bulk‑copy, submodule, private data import, or backend reuse from ECHELON is permitted.
- Future ECHELON integration is a separate explicitly authorized project.

## Status

Accepted in the repository boundary commit (commit‑pinned against `bcdd0caa18201cf1c0e09adc71aef7855365f495`). All subsequent Marcosville development respects this boundary.
