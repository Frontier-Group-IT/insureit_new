# INSUREIT Private Voice Agent Rollout

> **Created:** 2026-09-25  
> **Current phase:** Phase 1 — technical isolation  
> **Evidence state:** IMPLEMENTED on feature branch; production migration gate wired; canonical PR verification passed; merge/migration application pending  
> **Production calling state:** DISABLED / NOT IMPLEMENTED  
> **Existing Sarvam managed-agent system:** preserved unchanged as production fallback

## Purpose

INSUREIT is building its own private/custom-trained conversational voice agent in phases while preserving the existing working Sarvam managed Voice Agent system. Reuse proven INSUREIT campaign, CRM, renewal, enrichment, safety and reporting capabilities; build only the missing private-agent components.

The rollout must remain reversible. A failed private-agent experiment must never break or block the existing Sarvam path.

## Mandatory continuity instruction

Every agent working on Voice AI must read this file before changing the private-agent rollout and must update it after every major implementation, experiment, architecture decision, provider finding, evaluation result, rollout phase or important failure.

Each progress entry must state: date/phase, exact implementation or realization, files/schema/providers affected, evidence state, safety/isolation impact, tests/evidence and next safe step.

Never store secrets, phone numbers, raw transcripts, API keys, customer-sensitive payloads or private training examples here.

---

# Existing Sarvam system — protected working architecture

INSUREIT owns workflow state and business controls. Sarvam currently supplies the managed conversational agent and telephony execution layer.

```text
Voice Campaign / External Renewal Opportunity
        ↓
INSUREIT eligibility + business safeguards
        ↓
Local external_renewal_voice_attempt UUID
        ↓
Sarvam streamed cohort submission
        ↓
Sarvam managed Voice Agent + telephony
        ↓
Customer call
        ↓
Sarvam campaign webhook
        ↓
INSUREIT webhook validation + idempotency
        ↓
Normalized call result
        ↓
External Renewal state / follow-up / reporting
```

## Reusable INSUREIT capabilities

Reuse where safe instead of rebuilding:
- IT Super User authority boundary;
- Excel/CSV campaign import;
- RC/mobile validation and secondary-number fallback;
- Tata Commercial grouping/multi-vehicle handling;
- AuthBridge RC/insurance enrichment and cache path;
- Customer/vehicle/policy/external-renewal context;
- renewal bucket / days-to-expiry calculations;
- previous connected-call context;
- calling-window safeguards;
- DNC and terminal-state suppression;
- one-active-attempt protection;
- controlled retry rules;
- campaign lifecycle/queue concepts;
- normalized dispositions/structured outputs;
- reporting/export logic;
- CRM/follow-up projection rules.

## Sarvam-specific components that remain untouched

Examples include:
- `apps/web-portal/lib/sarvam-renewal-call.ts`
- `apps/web-portal/lib/sarvam-it-dispatch.ts`
- `apps/web-portal/lib/sarvam-production-queue.ts`
- Sarvam cohort/lifecycle/readiness/diagnostic modules;
- Sarvam webhook and retry/reconciliation controls;
- current Sarvam environment variables and production campaign binding.

Private-agent work must not refactor these merely for code sharing during the isolated rollout.

## Sarvam production database boundary

Current Sarvam workflow writes to:
- `voice_campaigns`
- `voice_campaign_members`
- `external_renewal_voice_attempts`
- `external_renewal_voice_attempt_events`

The private agent must never use these as writable private runtime state during the isolated rollout.

---

# Target private-agent architecture

```text
INSUREIT business/customer context
          ↓
Private Voice Campaign / Session
          ↓
Private dispatcher
          ↓
Telephony adapter
          ↓
Bidirectional audio gateway
          ↓
Streaming STT
          ↓
INSUREIT Agent Runtime
  ├─ deterministic conversation state
  ├─ prompt / agent version
  ├─ customer + prior-call memory
  ├─ approved knowledge / retrieval
  ├─ controlled business tools
  └─ structured output extraction
          ↓
Streaming TTS
          ↓
Customer

Private runtime state
          ↓
Private attempts / turns / evaluations
          ↓
Private reporting + A/B comparison
```

Provider interfaces are replaceable:
- `PrivateVoiceTelephonyProvider`
- `PrivateVoiceSpeechToTextProvider`
- `PrivateVoiceLanguageModelProvider`
- `PrivateVoiceTextToSpeechProvider`

Initial private-agent work may reuse Sarvam telephony/STT/TTS if useful, but the managed Sarvam conversational-agent layer remains independent.

---

# Rollout phases

## Phase 0 — Baseline, isolation and UI foundation — COMPLETE

Delivered:
- documented the working Sarvam architecture and reusable boundaries;
- created this rollout source of truth;
- added mandatory Voice AI continuity rules to `AGENTS.md` and Voice Integration `AGENTS.md`;
- added Development → Voice Agents → `Insureit Agent`;
- added IT-Super-User-only `/system/voice-integration/insureit-agent` UI shell;
- no private live calls and no Sarvam production behavior changes.

PR #2442 passed `Verify web portal` workflow #4710 and was merged as `9fdc75d21d3cfd1984fd5b460e9e2d1a434c5198`. Deployment was not separately requested/verified in that step.

## Phase 1 — Technical isolation — CURRENT

Goals:
- isolated private campaign/attempt/session/event/training/evaluation schema;
- independent private configuration namespace and kill switches;
- provider-neutral TypeScript contracts;
- a separate private status/execution API namespace;
- UI visibility into the isolation boundary;
- no Sarvam-path mutation and no live calling.

Phase 1 repository implementation:
- `apps/web-portal/lib/private-voice/contracts.ts`
- `apps/web-portal/lib/private-voice/config.ts`
- `apps/web-portal/app/api/system/private-voice/status/route.ts`
- `apps/web-portal/app/api/system/private-voice/dispatch/route.ts`
- `supabase/migrations/202609260001_private_voice_phase1_isolation.sql`
- `.github/workflows/apply-private-voice-phase1-isolation.yml`
- updated `/system/voice-integration/insureit-agent` page.

Prepared isolated tables:
- `private_voice_campaigns`
- `private_voice_campaign_members`
- `private_voice_attempts`
- `private_voice_attempt_events`
- `private_voice_sessions`
- `private_voice_turns`
- `private_voice_agent_versions`
- `private_voice_training_examples`
- `private_voice_evaluations`

All private tables have RLS enabled with no direct browser policies in Phase 1, leaving them service-role-only by default.

Independent environment namespace:
- `PRIVATE_VOICE_ENABLED`
- `PRIVATE_VOICE_OUTBOUND_ENABLED`
- `PRIVATE_VOICE_SHADOW_ENABLED`
- `PRIVATE_VOICE_TELEPHONY_PROVIDER`
- `PRIVATE_VOICE_STT_PROVIDER`
- `PRIVATE_VOICE_LLM_PROVIDER`
- `PRIVATE_VOICE_TTS_PROVIDER`

Defaults remain OFF/unconfigured. No Sarvam flag is reused.

The Phase 1 read-only status endpoint is IT-Super-User-only and exposes only safe configuration state. The separate private dispatch endpoint is deliberately hard-locked and always returns HTTP 409 in Phase 1; it cannot place a call or write an attempt. This reserves the private execution namespace without creating a shortcut into the Sarvam production dispatcher.

A dedicated schema workflow is prepared to apply and verify the nine private tables after merge. It verifies all nine tables, RLS, and continued presence of the existing Sarvam campaign/attempt tables.

The production deployment wait gate now explicitly recognizes `202609260001_private_voice_phase1_isolation.sql`, rejects unrelated migrations in the same release, and waits for `apply-private-voice-phase1-isolation.yml` before allowing the downstream production deployment path to continue.

**Important:** migration committed in Phase 1 is not the same as migration applied. Do not report these tables as present in production until the migration is explicitly applied and verified.

## Phase 2 — Training and evaluation dataset

Build a privacy-safe historical-call curation pipeline. Maintain separate training, validation and permanent untouched test sets. Exclude provider failures, empty/no-answer calls, corrupt transcripts and known poor/hallucinated examples. Teach structured behavior and decisions rather than blindly imitating transcripts.

## Phase 3 — Text-only private agent

Build and evaluate the agent brain without telephony: natural Hindi/Hinglish/English, customer/vehicle/policy context, prior-call awareness, concise renewal flow, safe identity handling and structured outputs.

## Phase 4 — Deterministic conversation state machine

INSUREIT controls the business state; the model controls natural wording. Core states include opening, convenience, renewal status, discovery, quote, callback, already-renewed, wrong-person, DNC, human-assistance and close.

## Phase 5 — Controlled tools

Expose narrow server-validated tools instead of direct database access: context lookup, previous call, quote request, follow-up scheduling, already-renewed, wrong-person, DNC and human-assistance actions.

## Phase 6 — Provider-neutral speech adapters

Implement swappable telephony/STT/LLM/TTS providers behind the Phase 1 interfaces.

## Phase 7 — Real-time audio gateway

Streaming audio, VAD/turn detection, partial transcripts, response streaming, barge-in, silence/timeout handling, recovery and latency metrics.

## Phase 8 — Shadow mode

Sarvam remains authoritative and speaks to the customer. Private agent receives approved context/transcript in parallel and proposes next response/outcome only; it is not heard by the customer.

## Phase 9 — Internal test calls

Approved internal/test numbers only, including interruptions, silence, wrong-person, DNC, already-renewed, callback, quote, claims objections and multi-vehicle scenarios.

## Phase 10 — Controlled customer pilot

Explicit cohorts such as 20 → 50 → 100 → 250, expanding only after evidence passes.

## Phase 11 — A/B evaluation and gradual adoption

Compare Sarvam managed vs INSUREIT Private on cost, latency, call duration, extraction accuracy, business outcomes, compliance and conversation quality. Sarvam remains fallback unless explicitly retired later.

---

# Promotion gates

Before meaningful production migration target:
- DNC compliance: 100%;
- no invented brand/company identity: 100%;
- wrong-person handling: >=99%;
- disposition accuracy: >=95%;
- callback extraction: >=95%;
- quote-request extraction: >=97%;
- previous-call awareness: >=98%;
- controlled tool correctness: >=99%;
- critical hallucination: approximately zero.

---

# Progress log

## 2026-09-25 — Phase 0 foundation

**Evidence:** PR #2442; Verify web portal #4710 success; merged as `9fdc75d21d3cfd1984fd5b460e9e2d1a434c5198`. Deployment not separately verified.

**Safety:** no private runtime/schema/providers/live calling; Sarvam production behavior untouched.

## 2026-09-26 — Phase 1 technical isolation

### Implemented on `feature/insureit-private-voice-phase1`
- introduced provider-neutral private voice contracts;
- introduced independent configuration/kill-switch namespace with all execution flags OFF by default;
- prepared nine isolated private-agent tables with RLS enabled and no browser policies;
- introduced an IT-Super-User-only private status endpoint;
- introduced a separate private dispatch endpoint that is intentionally locked with HTTP 409 during Phase 1;
- prepared a dedicated schema-application/verification workflow for the private tables;
- wired the private migration into the production schema wait gate with an unrelated-migration rejection guard;
- upgraded the `Insureit Agent` page from Phase 0 placeholder to Phase 1 foundation dashboard showing data boundaries, configuration flags and provider contracts;
- preserved the working Sarvam system without edits.

### Release-gate result
`deploy-production.yml` now explicitly recognizes `supabase/migrations/202609260001_private_voice_phase1_isolation.sql` and waits for `.github/workflows/apply-private-voice-phase1-isolation.yml`. The gate also rejects any unrelated migration bundled into this private-voice release before deployment can proceed.

### Not implemented / not authorized
- migration not yet applied to Supabase;
- no telephony provider implementation;
- no STT/TTS/LLM implementation;
- no provider credentials;
- no private dispatcher engine/provider call/webhook;
- no live private calls;
- no writes to Sarvam campaign/attempt tables.

### Evidence state
**IMPLEMENTED on feature branch; PR #2443 open. Verify web portal run #4716 passed on gate-wiring commit `281b7b6664fb6865d69b9d444c03d830d4d7ae75`. This documentation commit requires the canonical PR verification to pass again before merge. Migration application and merge remain pending.**

### Next safe step
Wait for the canonical verification on the latest PR head to pass. After explicit merge approval, allow the dedicated schema workflow to apply and verify only the isolated private schema. Then Phase 2 can build a privacy-safe Training Library extractor/reviewer without enabling telephony.
