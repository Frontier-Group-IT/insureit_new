# INSUREIT Private Voice Agent Rollout

> **Created:** 2026-09-25  
> **Current phase:** Phase 0 — baseline, isolation and UI foundation  
> **Evidence state:** IMPLEMENTED on feature branch; PR/CI/merge/deployment pending  
> **Production calling state:** DISABLED / NOT IMPLEMENTED  
> **Existing Sarvam managed-agent system:** preserve unchanged as production fallback

## Purpose

INSUREIT will build its own private/custom-trained conversational voice agent in phases while preserving the existing working Sarvam managed Voice Agent system. The goal is to reuse proven INSUREIT campaign, CRM, renewal, enrichment, safety and reporting capabilities and build only the missing private-agent components.

This rollout must remain reversible. A failed private-agent experiment must never break or block the existing Sarvam path.

## Mandatory continuity instruction

Every agent working on Voice AI must read this file before changing the private-agent rollout.

Update this file after every major:
- implementation phase;
- provider/telephony/STT/TTS/LLM experiment;
- architecture decision;
- training/evaluation milestone;
- shadow/pilot result;
- production realization or important failure.

Each progress entry must state:
1. date and phase;
2. exact implementation or realization;
3. files/schema/providers affected;
4. evidence state — IMPLEMENTED, MERGED, APPLIED, DEPLOYED, VERIFIED, BLOCKED or UNVERIFIED;
5. safety/isolation impact;
6. tests/evidence;
7. next safe step.

Never store secrets, phone numbers, raw transcripts, API keys, customer-sensitive payloads or private training examples in this document.

---

# Existing Sarvam system — current working architecture

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

## Existing reusable INSUREIT capabilities

These capabilities are already proven and should be reused where safe rather than rebuilt:

- IT Super User authority boundary;
- Excel/CSV campaign import;
- RC/mobile validation;
- optional secondary mobile fallback;
- Tata Commercial campaign parsing and multi-vehicle grouping;
- AuthBridge RC/insurance enrichment and cache path;
- Customer/vehicle/policy/external-renewal context;
- renewal bucket / days-to-expiry calculations;
- previous connected-call context;
- calling window;
- DNC and terminal-state suppression;
- one-active-attempt protection;
- manual busy/no-answer retry safety;
- campaign lifecycle and queue controls;
- normalized dispositions and structured outputs;
- reporting/export logic;
- CRM/follow-up projection rules;
- provider correlation by local attempt UUID;
- privacy boundary excluding raw transcript persistence.

## Existing Sarvam-specific components that remain untouched

The current production path includes Sarvam-specific modules such as:

- `apps/web-portal/lib/sarvam-renewal-call.ts`
- `apps/web-portal/lib/sarvam-it-dispatch.ts`
- `apps/web-portal/lib/sarvam-production-queue.ts`
- Sarvam lifecycle/readiness/diagnostic modules
- Sarvam webhook endpoint and retry/reconciliation controls
- current Sarvam environment variables and campaign binding

Private-agent work must not refactor these merely for code sharing during early rollout phases.

## Existing production database boundary

The current Sarvam workflow writes to:

- `voice_campaigns`
- `voice_campaign_members`
- `external_renewal_voice_attempts`
- `external_renewal_voice_attempt_events`

The private agent must not use these tables as writable private runtime state during the isolated rollout.

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
  ├─ conversation state machine
  ├─ private agent prompt/version
  ├─ customer + prior-call memory
  ├─ retrieval / approved knowledge
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
Private reporting + comparison
```

Provider interfaces should ultimately be replaceable:
- TelephonyProvider
- SpeechToTextProvider
- LanguageModelProvider
- TextToSpeechProvider

Initial private-agent work may reuse Sarvam speech/telephony services if commercially and technically useful, but Sarvam's managed conversational-agent layer must remain independent.

---

# Rollout phases

## Phase 0 — Baseline, isolation and UI foundation

Goals:
- document the working Sarvam architecture;
- freeze the private-agent safety boundary;
- establish this rollout log;
- add a separate IT-only `Insureit Agent` workspace;
- establish baseline comparison metrics;
- make no private live calls and no production Sarvam behavior changes.

UI route:
- `/system/voice-integration/insureit-agent`

Phase 0 page is intentionally UI-only. It is a future operational shell and must clearly label non-functional modules as planned/not connected.

Baseline metrics to preserve for future A/B comparison:
- cost per connected minute;
- cost per meaningful conversation;
- average connected duration;
- connectivity rates;
- disposition accuracy;
- quote-request capture;
- callback capture;
- wrong-person handling;
- DNC compliance;
- repetition/quality issues;
- latency;
- human-assistance rate.

## Phase 1 — Technical isolation

Planned:
- private campaign/attempt/session/event schema;
- independent private kill switches;
- private provider configuration namespace;
- separate private execution routes;
- read-only reuse of business facts;
- no Sarvam-path mutation.

Candidate tables:
- `private_voice_campaigns`
- `private_voice_campaign_members`
- `private_voice_attempts`
- `private_voice_attempt_events`
- `private_voice_sessions`
- `private_voice_turns`
- `private_voice_agent_versions`
- `private_voice_training_examples`
- `private_voice_evaluations`

No migration is authorized by Phase 0 itself.

## Phase 2 — Training and evaluation dataset

Build a privacy-safe dataset pipeline from historical calls.

Separate:
- training set;
- validation set;
- permanent untouched test set.

Exclude unsuitable training examples such as provider failures, empty/no-answer audio, corrupt transcripts and known poor/hallucinated behavior.

Store structured behavior targets rather than blindly imitating transcripts:
- context;
- customer intent;
- ideal agent decision;
- expected tools/state transition;
- disposition;
- interest;
- objection;
- callback extraction;
- summary;
- quality labels.

## Phase 3 — Text-only private agent

Build and evaluate the agent brain without telephony.

Required capabilities:
- natural Hindi/Hinglish/English response;
- customer/vehicle/policy awareness;
- prior-call awareness;
- concise renewal flow;
- safe identity handling;
- structured outputs;
- no invented premium/IDV/claim/insurer promises.

## Phase 4 — Deterministic conversation state machine

Business flow controlled by INSUREIT; LLM controls natural wording.

Example states:
- opening;
- identity/convenience;
- renewal status;
- discovery;
- quote request;
- callback;
- already renewed;
- wrong person;
- DNC;
- human assistance;
- close.

## Phase 5 — Controlled tools

Expose narrow backend tools rather than database access:
- get customer context;
- get vehicle/policy context;
- get previous call summary;
- request quote;
- schedule follow-up;
- mark already renewed;
- mark wrong person;
- mark DNC;
- request human assistance.

Every tool remains server-validated.

## Phase 6 — Provider-neutral speech adapters

Implement replaceable telephony/STT/LLM/TTS interfaces.

No provider becomes a hard dependency of private business logic.

## Phase 7 — Real-time audio gateway

Build:
- streaming audio ingress/egress;
- VAD / turn detection;
- partial transcripts;
- response streaming;
- barge-in/interruption cancellation;
- timeout/silence handling;
- session recovery;
- latency metrics.

## Phase 8 — Shadow mode

Existing Sarvam customer call remains authoritative.

Private agent receives context/transcript in parallel and proposes:
- next response;
- disposition;
- structured extraction;
- next action.

Private output is never spoken to the customer in shadow mode.

## Phase 9 — Internal test calls

Only approved internal/test numbers.

Test normal and adversarial scenarios including interruptions, silence, wrong person, DNC, already renewed, callbacks, quote requests, claims objections and multiple vehicles.

## Phase 10 — Controlled customer pilot

Gradual explicit cohorts, for example:
- 20;
- 50;
- 100;
- 250;
- larger cohorts only after evidence passes.

## Phase 11 — A/B evaluation and gradual adoption

Compare Sarvam managed vs INSUREIT Private:
- cost;
- latency;
- conversation duration;
- extraction accuracy;
- business outcomes;
- compliance;
- conversation quality.

Sarvam remains available as fallback unless explicitly retired later.

---

# Promotion gates

Private calling must not reach broad production merely because calls technically connect.

Target gates before meaningful production migration:
- DNC compliance: 100%;
- no invented brand/company identity: 100%;
- wrong-person handling: >=99%;
- disposition accuracy: >=95%;
- callback extraction: >=95%;
- quote-request extraction: >=97%;
- previous-call awareness: >=98%;
- controlled tool correctness: >=99%;
- critical hallucination: approximately zero.

Exact thresholds may be refined after the evaluation framework is implemented, but any change must be recorded here.

---

# Phase 0 progress log

## 2026-09-25 — Phase 0 foundation

### Implemented
- documented the existing working Sarvam architecture and reusable boundaries;
- documented the full phased private-agent rollout;
- added mandatory continuity instructions to root and Voice Integration AGENTS files;
- added Development → Voice Agents → `Insureit Agent`;
- added IT-Super-User-only `/system/voice-integration/insureit-agent` UI foundation;
- page explicitly shows current isolation, reuse plan, rollout phases and future workspaces.

### Not implemented
- no private-agent database schema;
- no training ingestion;
- no LLM/runtime;
- no STT/TTS integration;
- no private telephony;
- no live/private campaign execution;
- no private webhook;
- no provider credentials;
- no change to current Sarvam production behavior.

### Safety
The Sarvam managed Voice Agent remains the working production fallback and this phase does not modify its dispatch, webhooks, campaign lifecycle, prompts, calling window, retries, reporting or schema.

### Evidence state
**IMPLEMENTED on feature branch; PR/CI/merge/deployment pending.**

### Next safe step
Phase 1 should first design the isolated schema and provider-neutral runtime contracts. Do not apply a migration or enable outbound calls without explicit approval and normal repository verification.
