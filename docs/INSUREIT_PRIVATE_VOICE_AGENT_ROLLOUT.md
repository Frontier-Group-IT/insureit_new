# INSUREIT Private Voice Agent Rollout

> **Created:** 2026-09-25  
> **Current phase:** Phase 2 — training and evaluation dataset foundation  
> **Production calling state:** PRIVATE CALLING DISABLED / NOT IMPLEMENTED  
> **Existing Sarvam managed-agent system:** preserved unchanged as production fallback

## Purpose

INSUREIT is building its own private/custom-trained conversational voice agent in phases while preserving the existing working Sarvam managed Voice Agent system. Reuse proven INSUREIT campaign, CRM, renewal, enrichment, safety and reporting capabilities; build only the missing private-agent components.

The rollout must remain reversible. A failed private-agent experiment must never break or block the existing Sarvam path.

## Mandatory continuity instruction

Every agent working on Voice AI must read this file before changing the private-agent rollout and must update it after every major implementation, experiment, architecture decision, provider finding, evaluation result, rollout phase or important failure.

Each progress entry must state: date/phase, exact implementation or realization, files/schema/providers affected, evidence state, safety/isolation impact, tests/evidence and next safe step.

Never store secrets, phone numbers, raw transcripts, API keys, customer-sensitive payloads or private training examples in this document.

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
INSUREIT validation + idempotency
        ↓
Normalized call result / follow-up / reporting
```

Reusable INSUREIT capabilities include IT-Super-User authority, campaign imports, RC/mobile validation, Tata grouping, AuthBridge enrichment, customer/vehicle/policy context, renewal buckets, previous-call context, calling window, DNC/terminal suppression, one-active-attempt protection, retry rules, normalized outcomes, reporting and CRM follow-up projections.

Sarvam-specific production modules, provider bindings, webhooks, lifecycle controls, calling-window logic, retry controls and prompts remain independently operable and are not refactored merely to support the private system.

Current Sarvam workflow writes to:
- `voice_campaigns`
- `voice_campaign_members`
- `external_renewal_voice_attempts`
- `external_renewal_voice_attempt_events`

Private-agent runtime state must not be written into those tables.

---

# Target private-agent architecture

```text
INSUREIT business/customer context
          ↓
Private campaign / session
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
```

Provider interfaces remain replaceable: Telephony, STT, LLM and TTS.

---

# Rollout phases

## Phase 0 — Baseline, isolation and UI foundation — COMPLETE

Delivered the working-system documentation, private-agent continuity rules, IT-only `Insureit Agent` workspace and explicit no-live-call boundary.

PR #2442 passed `Verify web portal` workflow #4710 and merged as `9fdc75d21d3cfd1984fd5b460e9e2d1a434c5198`.

## Phase 1 — Technical isolation — COMPLETE

Delivered:
- provider-neutral private voice contracts;
- independent `PRIVATE_VOICE_*` configuration and kill switches;
- separate private status/dispatch API namespace;
- isolated private schema;
- dedicated schema workflow and production migration wait gate;
- Phase 1 UI foundation;
- private dispatch remains hard-locked and cannot place calls.

Prepared/applied private tables:
- `private_voice_campaigns`
- `private_voice_campaign_members`
- `private_voice_attempts`
- `private_voice_attempt_events`
- `private_voice_sessions`
- `private_voice_turns`
- `private_voice_agent_versions`
- `private_voice_training_examples`
- `private_voice_evaluations`

PR #2443 passed canonical `Verify web portal` run #4717 and merged as `910ed1464c1cc77f58b712343c35ddeb12a5d1bd`.

### 2026-09-26 realization
A direct production database readiness check confirmed the Phase 1 private tables are present (`private_voice_training_examples`, `private_voice_evaluations`, `private_voice_campaigns` resolved successfully). This updates the earlier pre-merge note that migration application was still pending. This verification did not enable private calling.

## Phase 2 — Training and evaluation dataset — CURRENT

Goal: build a privacy-safe historical-call curation pipeline with separate training, validation and permanent-test candidates. Teach structured behavior/outcomes rather than blindly imitating transcripts.

### Phase 2 implementation on `feature/insureit-private-voice-phase2-training-library`

Added:
- `apps/web-portal/lib/private-voice/training-library.ts`
- `apps/web-portal/app/api/system/private-voice/training-library/stage/route.ts`
- upgraded `/system/voice-integration/insureit-agent` to a real Training Library workspace.

Historical-source eligibility requires:
- `submission_status = completed`;
- `connectivity_status = connected`;
- `completion_status = completed`;
- duration >= 20 seconds;
- persisted `call_summary`;
- persisted structured `call_disposition`.

Additional low-signal screening removes generic no-response/no-audio `no_decision` examples before they are staged.

### Privacy boundary

The staging pipeline never copies mobile, RC, customer name or raw provider payloads into the private training record. It resolves source identity only to redact sensitive literals from stored summaries/objections, applies generic mobile/RC/long-ID redaction, and stores only approved contextual features such as renewal bucket, days-to-expiry, repeat-call state, vehicle make/model and duration bucket.

The source attempt UUID is retained as `source_reference` for traceability and de-duplication.

### Dataset split

Eligible source UUIDs are deterministically assigned:
- 70% training;
- 15% validation;
- 15% permanent-test candidate.

This keeps the split stable across repeated staging runs. Test rows are marked as permanent-test candidates in quality labels; later review/versioning work must ensure they are never used for training.

### Important realization — raw transcript availability

The current Sarvam production database intentionally persists normalized outcomes and `call_summary`, but **does not persist raw conversation transcripts/turns** in `external_renewal_voice_attempts` or `external_renewal_voice_attempt_events`.

Therefore Phase 2 cannot honestly reconstruct full historical conversations from the current production database. The first Training Library uses privacy-redacted structured call summaries/outcomes only.

If the user supplies the larger raw transcript corpus mentioned for training, it must enter through a separate privacy-reviewed import pipeline. Do not fabricate missing conversation turns from summaries.

### Phase 2 UI

The Insureit Agent page now shows:
- historical attempt count;
- eligible-source count;
- automatically excluded-source count;
- staged total;
- training / validation / test counts;
- recent redacted examples;
- eligibility, privacy, split and low-signal rules;
- explicit raw-transcript-not-stored notice;
- IT-only `Stage next 200 eligible calls` action.

The staging action is explicit/manual; page load does not mutate data.

### Verification findings — preserved history

- Canonical PR run **#4719** passed the regression suite but failed TypeScript because the optional Next.js `searchParams` fallback inferred as `{}`. The page now resolves search params through an explicit `Record<string, string | string[] | undefined>` boundary. No customer/runtime data was affected.
- Canonical PR run **#4720** then passed all regressions and TypeScript but failed lint only on two `@typescript-eslint/no-explicit-any` findings in the small shared Supabase count-query callback. The callback was narrowly documented/suppressed at that unavoidable generated-query-builder boundary rather than disabling lint for the file. No production behavior was affected.
- Canonical latest-head run **#4722** passed regressions, typecheck, lint and production build. PR #2445 merged as `0bdc0907d83a2db7fd3bcdc605a59dc85fa5aaa5`.

### Controlled pre-staging privacy review — 2026-09-26

Before writing any training examples, a read-only preview of eligible historical summaries was inspected. The preview found a real privacy edge case: a summary could contain only the customer's first name while the source identity field contained a longer full name, so exact full-name replacement alone could leave that first-name token visible.

No training rows had been staged when this was found (`private_voice_training_examples` historical-call count remained zero).

A follow-up branch `fix/private-voice-training-redaction-review` now:
- moves redaction into a dedicated pure helper;
- performs case-insensitive full-name replacement;
- additionally redacts individual customer-name tokens of three or more letters;
- preserves the existing mobile, RC and long-ID redaction rules;
- adds a regression covering partial-name, case-insensitive-name, mobile, RC and long-ID leakage.

The controlled first batch must remain blocked until this redaction hardening passes canonical CI and is merged.

### Not implemented / not authorized
- no raw transcript import yet;
- no human approve/exclude/relabel workflow yet;
- no frozen/versioned dataset releases yet;
- no text LLM agent yet;
- no evaluation replay engine yet;
- no private telephony/STT/TTS;
- no live private calls;
- no writes to Sarvam campaign/attempt tables.

### Evidence state
**PR #2445 MERGED after Verify web portal #4722. Redaction hardening is IMPLEMENTED on `fix/private-voice-training-redaction-review`; CI/merge pending. No historical training rows staged yet.**

### Next safe step
Run canonical verification for the redaction-hardening branch. After it is green and merged, stage a small controlled batch, inspect every stored example for residual identity leakage and split correctness, then implement human review plus frozen dataset versioning. Phase 3 must not train or evaluate an LLM until the permanent-test boundary and review workflow are proven.

## Phase 3 — Text-only private agent

Build and evaluate the agent brain without telephony: Hindi/Hinglish/English, customer/vehicle/policy context, prior-call awareness, concise renewal flow, safe identity handling and structured outputs.

## Phase 4 — Deterministic conversation state machine

INSUREIT controls the business state; the model controls natural wording. Core states include opening, convenience, renewal status, discovery, quote, callback, already-renewed, wrong-person, DNC, human-assistance and close.

## Phase 5 — Controlled tools

Expose narrow server-validated tools instead of direct database access: context lookup, previous call, quote request, follow-up scheduling, already-renewed, wrong-person, DNC and human-assistance actions.

## Phase 6 — Provider-neutral speech adapters

Implement swappable telephony/STT/LLM/TTS providers behind the Phase 1 interfaces.

## Phase 7 — Real-time audio gateway

Streaming audio, VAD/turn detection, partial transcripts, response streaming, barge-in, silence/timeout handling, recovery and latency metrics.

## Phase 8 — Shadow mode

Sarvam remains authoritative and speaks to the customer. Private agent receives approved context/transcript in parallel and proposes next response/outcome only.

## Phase 9 — Internal test calls

Approved internal/test numbers only.

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

## 2026-09-25 — Phase 0
PR #2442 merged; baseline/isolation/UI shell completed; no private runtime or calling.

## 2026-09-26 — Phase 1
PR #2443 merged after Verify web portal #4717. Isolated private schema/config/provider contracts delivered. Production database check later confirmed private schema presence. Private outbound remains disabled.

## 2026-09-26 — Phase 2
PR #2445 merged as `0bdc0907d83a2db7fd3bcdc605a59dc85fa5aaa5` after Verify web portal #4722 passed. Training Library pipeline/UI, explicit eligibility, low-signal screening, privacy redaction and deterministic 70/15/15 splits are now merged. A read-only pre-staging review then found a partial customer-name redaction edge case before any training rows were written. Follow-up hardening is implemented on `fix/private-voice-training-redaction-review`; CI/merge pending. Private calling remains disabled.
