# ADR 002 — Platform Feasibility (P0 verification)

## Context

P0 requires verification that the proposed iOS and Android platform capabilities (CarPlay entitlements, background modes, SMS/calendars, etc.) are real and that the platform constraints (Apple\u2019s entitlement timing, Android\u2019s car category restrictions, native audio focus, etc.) are accurately modeled before implementation.

## Decision

1. **CarPlay conversation entitlement:** The entitlement `com.apple.developer.carplay-voice-based-conversation` exists in Apple\u2019s official CarPlay documentation and is available from **iOS 26.4**. It is a separate entitlement not already granted to WHINK. This is a known entitlement; it must be explicitly requested, and implementation must follow the developer‑guide templates and minimum SDK. This is a **PLATFORM FACT** for Marcosville.

2. **Background notifications:** Apple\u2019s background update guide explicitly says silent push is not guaranteed; developers must assume it is unreliable. CarPlay voice entitlement is **not** a persistent listening guarantee. This is a **PLATFORM FACT**.

3. **Android Auto category:** Google\u2019s current category table lists `messaging` (broad) and `templated‑messaging`/`calling` (labs). Generic AI assistant category does not exist; generic assistant is not an approved Android Auto category. This is a **PLATFORM FACT**.

4. **Native audio and permission models:** iOS and Android have documented audio focus, microphone permission, and foreground/background restrictions that are enforced by the OS. This is a **PLATFORM FACT**.

5. **SMS / calendar / contact adapters:** Native SDKs exist for these capabilities. However, precise iOS/SMS silent inbox access or generic WhatsApp replacement is **not** supported. This is a **PLATFORM FACT**.

6. **Vehicle integration constraints:** Real device testing is required; entitlements, templates, and SDK limits must be validated per Apple\u2019s developer guide. Platform capability must be tested on real head units; simulator alone is insufficient. This is a **PLATFORM FACT**.

## Status

Accepted for P0 evidence. Feasibility analysis referenced in the architecture plan; CarPlay conversation is a genuine path with a specific entitlement timeline; Android Auto messaging is the only publicly supported category; all other adapter capabilities are real but have explicit boundaries and no universal inbox access.

## Next Steps

P1 must use these platform facts to drive concrete API/contribution contracts and must include real device verification for each enabled platform surface.
