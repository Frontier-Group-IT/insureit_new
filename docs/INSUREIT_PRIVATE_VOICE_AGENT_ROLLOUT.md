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
A direct production database readiness check confirmed the Phase 1 private tables are present (`private_voice_training_examples`, `private_voice_evaluations`, `private_voice_campaigns` resolved successfully). This verification did not enable private calling.

## Phase 2 — Training and evaluation dataset — CURRENT

Goal: build a privacy-safe historical-call curation pipeline with separate training, validation and permanent-test candidates. Teach structured behavior/outcomes rather than blindly imitating transcripts.

### Phase 2 training-library foundation — MERGED

PR #2445 delivered:
- `apps/web-portal/lib/private-voice/training-library.ts`;
- `apps/web-portal/app/api/system/private-voice/training-library/stage/route.ts`;
- a real Training Library workspace at `/system/voice-integration/insureit-agent`.

Historical-source eligibility requires completed submission, connected/completed call, duration >=20 seconds, persisted `call_summary` and structured `call_disposition`. Generic low-signal no-response/no-audio `no_decision` rows are screened.

Eligible source UUIDs are deterministically split 70% training / 15% validation / 15% permanent-test candidate.

PR #2445 passed canonical `Verify web portal` #4722 and merged as `0bdc0907d83a2db7fd3bcdc605a59dc85fa5aaa5`.

### Important realization — raw transcript availability

The current Sarvam production database intentionally persists normalized outcomes and `call_summary`, but **does not persist raw conversation transcripts/turns** in `external_renewal_voice_attempts` or `external_renewal_voice_attempt_events`.

Therefore Phase 2 cannot honestly reconstruct full historical conversations from the current production database. The Training Library uses privacy-redacted structured call summaries/outcomes only. Any later raw transcript corpus must enter through a separate privacy-reviewed import pipeline. Never fabricate missing conversation turns from summaries.

### Redaction hardening — MERGED

A read-only pre-staging review found a real privacy edge case: an attempt summary could contain only a customer's first name while the source identity contained a longer full name, so exact full-name replacement alone could leave the first-name token visible.

No historical training rows had been staged when the edge case was found.

PR #2447 moved redaction into `training-redaction.ts`, made full-name matching case-insensitive, additionally redacts individual customer-name alphabetic tokens of three or more characters, and preserves mobile/RC/long-ID rules. Canonical Verify web portal #4725 passed and PR #2447 merged. Private calling remained disabled.

### Controlled first dataset batch — APPLIED AND AUDITED

After redaction hardening, a controlled first batch of **25** eligible historical examples was staged into `private_voice_training_examples` as `draft` only:
- 16 training;
- 7 validation;
- 2 permanent-test candidates.

The first audit verified split integrity, identifier redaction, draft-only state and no raw conversation payloads. A later manual narrative review found **one summary containing a provider-generated first-name introduction that did not match the opportunity identity**, so identity-based redaction could not detect it. That row was immediately sanitized in the private training table; the follow-up SQL check confirmed the detected narrative-name pattern count returned to zero.

The current Phase 2 branch now additionally redacts common provider narrative-name patterns such as `The customer, <Name>, ...`, `customer named <Name>`, titled names, and `Customer <Name> expressed/said/...`, even when the source opportunity identity is different. Regression coverage includes this identity-mismatch case. This finding does not affect the Sarvam source tables or production calling.

No raw transcript turns are stored. The test examples remain marked permanent-test candidates.

### Human review + frozen dataset versioning — CURRENT PR #2453

Branch: `feature/private-voice-phase2-review-versioning`.

Implemented on the branch:
- IT-Super-User-only approve/exclude actions for draft/reviewed examples;
- no split editing during review;
- explicit permanent-test invariant checks;
- rejection of review changes for examples already frozen into a dataset;
- `private_voice_dataset_versions` and `private_voice_dataset_members` migration;
- immutable dataset-member snapshots enforced by database trigger;
- deterministic stable JSON snapshots with SHA-256 hashes;
- freeze gate requiring at least one approved training, validation and permanent-test example;
- permanent-test candidates cannot be frozen into training/validation;
- cumulative dataset releases include the full approved corpus, loaded through deterministic pagination and written in bounded membership batches so Supabase response/insert limits cannot silently truncate a release;
- review queue, approved split counts, freeze action and frozen-version history in the Insureit Agent UI;
- private-voice redaction and dataset-versioning regressions are directly runnable and executed by canonical `Verify web portal` CI;
- additional training-redaction regression coverage for identity-mismatch narrative names;
- dedicated `apply-private-voice-dataset-versioning.yml` schema workflow verifies the Phase 2 tables, review columns, RLS, immutable-member trigger and preserved Sarvam tables;
- guarded production deployment recognizes `20260926020000_private_voice_dataset_versions.sql` and waits for the Phase 2 schema workflow before Vercel deployment.

The migration is committed but **not applied merely by creating PR #2453**. Merge is not migration application and migration application is not deployment.

### 2026-09-26 pre-merge hardening realization

A final review-thread audit after earlier green CI found three repository-level gaps that were not proven by the prior run: the Phase 2 migration was not yet wired into the production deployment gate, the approved-example freeze query could be truncated by the Supabase row cap, and the new private-voice regression files were typechecked but not executed by canonical CI. All three were fixed on the same PR branch before merge consideration. This follow-up did not apply any migration, enable private calling, or change Sarvam behavior.

### Current safety boundary

Not implemented / not authorized:
- no raw transcript import yet;
- no text LLM agent yet;
- no evaluation replay engine yet;
- no private telephony/STT/TTS;
- no live private calls;
- no writes to Sarvam campaign/attempt tables;
- no change to Sarvam provider configuration, webhook behavior, calling window, kill switch or production prompts.

### Evidence state

**PR #2445 MERGED; PR #2447 MERGED; controlled 25-row batch APPLIED; follow-up privacy review found and sanitized one identity-mismatch narrative first-name leak; PR #2453 IMPLEMENTED with migration-gate wiring, deterministic full-corpus paging/batched membership writes, and canonical private-voice regression execution added after a final review-thread audit. Latest-head canonical CI must pass again before merge. Dataset-versioning migration NOT APPLIED. Private calling remains disabled.**

### Next safe step

Get the latest PR #2453 head fully green in canonical `Verify web portal`. Do not merge on failed CI. After explicit merge authorization, allow the dedicated Phase 2 schema workflow to apply/verify the dataset-versioning migration before exposing the review/freeze UI as operational. Then human-review the controlled 25-row batch, freeze the first reproducible dataset release, verify snapshot hashes/split boundaries, and only then begin Phase 3 text-agent evaluation against the untouched permanent-test set.

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
PR #2443 merged after Verify web portal #4717. Isolated private schema/config/provider contracts delivered. Production database check confirmed private schema presence. Private outbound remains disabled.

## 2026-09-26 — Phase 2
PR #2445 merged after Verify web portal #4722. PR #2447 then merged after Verify web portal #4725 to harden partial-name redaction before staging. A controlled first batch of 25 draft examples (16 train / 7 validation / 2 test) was applied. A later narrative audit found one provider-generated first-name introduction that did not match the source identity; that private training row was sanitized and the branch redaction helper/regression was hardened for identity-mismatch narrative names. PR #2453 implements human approve/exclude review plus immutable hashed frozen-dataset releases. A final pre-merge audit then added the missing Phase 2 schema deployment gate, deterministic full-corpus paging/batched membership writes, and canonical execution of the private-voice regressions. Latest-head CI is required before merge and its migration is not yet applied. Private calling remains disabled.
