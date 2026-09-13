# External Renewal Sarvam Voice Workflow Handoff

> **Created:** 2026-09-13 IST
>
> **Status:** USER-APPROVED DIRECTION / PLANNING ONLY. No production schema, outbound calling, webhook, AuthBridge enrichment, Partner UI or Sarvam automation change is authorized by this document alone.
>
> This is the durable source of truth for connecting INSUREIT External Renewal Opportunities to the Sarvam voice-agent workflow. Future agents working on `/partner/renewals/external`, Sarvam outbound calling, AuthBridge enrichment for external opportunities, call-result ingestion, or partner-visible voice workflow UI must read this file before making changes.
>
> Never store Sarvam API keys, AuthBridge credentials, gateway secrets, phone lists, raw production customer transcripts, OTPs, payment credentials or other sensitive customer data in this document or source control.

## 1. Approved business boundary

The first production Sarvam integration is intentionally limited to **External Renewal Opportunities**.

Canonical Partner route:

```text
/partner/renewals/external
```

External renewal opportunities are retargeting leads based on known external-policy/vehicle information and remain logically isolated from verified INSUREIT policy/customer/vehicle business until an explicit conversion boundary is crossed.

Do not silently turn an external opportunity into a verified INSUREIT Customer, Vehicle or Policy record merely because AuthBridge or Sarvam supplied additional data.

The existing external renewal page currently provides due/follow-up/expired/future worklists, outreach status filters, policy-intake state and per-opportunity interaction history. The Sarvam workflow must extend that model rather than creating a second unrelated lead queue.

## 2. Role and control boundary

### Partner users

Partner users need operational visibility and limited workflow actions only. They must **not** receive full Sarvam administration.

Partner-facing capabilities should eventually include, subject to approved permission design:

- see whether an opportunity is eligible for AI calling
- see data-readiness / missing-data state
- see latest call state and concise call outcome
- see disposition such as Interested, Follow-up, Not Interested, Already Renewed, Wrong Person, Human Assistance or No Decision
- see callback/follow-up preference when appropriate
- review call summary and next action within their authorized opportunity scope
- manually request a single AI call or place selected eligible opportunities into a controlled calling queue, if and only if the permission model explicitly allows this
- take over an opportunity for human follow-up
- progress an interested opportunity toward Policy Intake through the existing conversion boundary

Partners must not be able to:

- edit the Sarvam system prompt, greeting, voice, language, model/runtime settings or tool definitions
- see or modify Sarvam/AuthBridge secrets or integration environment configuration
- alter organization-wide call limits, retry rules, global schedules, provider connection or purchased-number configuration
- create unrestricted campaigns over arbitrary phone lists
- bypass consent / do-not-contact / eligibility gates
- inspect other partners' opportunities or unrestricted organization-wide transcripts
- directly invoke AuthBridge with arbitrary RC numbers outside approved opportunity actions

### IT Super User

Full integration administration belongs only to **IT Super User** with the existing critical system-management authorization boundary.

The IT Super User administration surface should ultimately control:

- Sarvam agent/version configuration references
- campaign defaults and organization-wide limits
- provider phone-number/connection configuration metadata
- webhook health and delivery diagnostics
- integration pause/kill switch
- AuthBridge enrichment policy and operational diagnostics
- tool/API health
- prompt/agent-version rollout metadata
- call failure/retry policy
- audit views and organization-level metrics

Do not place these administrative controls on the Partner External Renewal Opportunities page.

## 3. Current confirmed building blocks

### External renewal application model

Current portal code already exposes:

- `getPartnerExternalRenewalSummary()`
- `listPartnerExternalRenewals(...)`
- `getPartnerExternalRenewalDetail(...)`
- `recordPartnerExternalRenewalInteraction(...)`
- `getPartnerExternalRenewalIntakeLink(...)`
- `linkPartnerExternalRenewalPolicyIntake(...)`

Current opportunity data includes known values such as account/customer/contact name, mobile, chassis/registration where available, vehicle make/model/LOB, invoice-derived policy dates, current insurer/policy number where available, opportunity status, last interaction, next follow-up and Policy Intake linkage.

Current interaction types are `call`, `whatsapp`, `note`, and `follow_up`; current opportunity outcomes already include contact-attempted, connected, interested, quote-requested, quote-shared, follow-up, renewed-elsewhere, invalid-contact, do-not-contact and lost semantics.

The voice-agent integration should align to this existing lifecycle rather than inventing conflicting status vocabulary.

### AuthBridge

INSUREIT already has a protected server-side AuthBridge Detailed RC path using service 372 through the AWS integration gateway. The current normalized response can provide registration/vehicle/compliance details and, when the provider supplies them, insurer, policy number and policy-expiry information.

AuthBridge must remain server-side, explicit, privacy-minimized and credit-controlled. Do not expose the relay secret/provider credentials or raw decrypted provider payload to Partner browsers or Sarvam.

### Sarvam

A Sarvam Voice Agent has been configured and successfully tested over a real phone call using a purchased Sarvam/Vobiz number. This user-observed test proves basic real-phone connectivity for the configured agent, but does not yet prove production workflow integration, webhook security, scale, consent compliance, cost controls, CRM persistence or production-customer quality.

The existing OpenAI voice lab remains a separate benchmark. Do not replace it as part of this workflow unless separately approved.

## 4. Target architecture

```text
External Renewal Opportunity
        |
        v
INSUREIT eligibility/readiness gate
        |
        +--> optional AuthBridge enrichment through INSUREIT server only
        |
        v
INSUREIT Voice Call Queue
        |
        v
Sarvam outbound campaign/call
        |
        v
Customer phone conversation
        |
        +--> only approved INSUREIT tools when explicitly connected
        |
        v
Sarvam completion webhook/event
        |
        v
INSUREIT webhook verification + idempotent ingestion
        |
        +--> voice-call attempt/history
        +--> external-renewal interaction/outcome
        +--> next follow-up preference
        +--> human handoff task
        +--> Policy Intake conversion candidate
        |
        v
Partner External Renewal Opportunities UI
```

INSUREIT, not Sarvam, must remain the source of truth for opportunity state, authorization, call eligibility, suppression/do-not-contact state, conversion and audit history.

## 5. AuthBridge enrichment policy for external opportunities

The external data source may not contain complete vehicle or policy information. AuthBridge can be used where the workflow genuinely needs additional RC-derived context.

### Recommended enrichment strategy

Use a **readiness/enrichment layer**, not automatic uncontrolled lookups.

1. Prefer existing external-opportunity values first.
2. Determine whether the opportunity has a usable registration number.
3. Reuse the existing fresh AuthBridge cache where allowed by the canonical AuthBridge integration.
4. Only call the paid provider when required data is missing/stale and the opportunity is eligible for the action.
5. Normalize only approved fields into an external-opportunity enrichment snapshot/cache.
6. Keep enrichment separate from verified Customer/Vehicle/Policy masters until an explicit conversion action occurs.
7. Never send the raw AuthBridge response to Sarvam.

### Minimum useful call context

For a renewal call, the agent should receive only the fields actually available and appropriate to mention. Candidate fields:

- customer/contact display name
- mobile number as call destination; it need not be repeated in the spoken prompt
- vehicle registration when known
- manufacturer/model when known
- current insurer when known
- policy expiry when known
- external opportunity source/context

Do not fabricate absent premium, IDV, NCB, policy terms, coverage, discount or add-on values. AuthBridge currently does not provide a general entitlement to infer premium or IDV.

### Missing-data behavior

The voice workflow must be robust to incomplete context. The agent should not expose internal data uncertainty in an awkward way or guess missing facts. If vehicle/model/insurer is unavailable, use a generic renewal introduction and ask only the minimum clarifying question required.

## 6. Proposed page redesign — Partner External Renewal Opportunities

The page should become a **Renewal Outreach Workspace**, not a Sarvam administration console.

### A. Page header

Keep the existing title/context and separation from verified INSUREIT business. Add a small operational status on the right, for example:

```text
AI Calling: Available
```

This is a read-only service status for Partners, not a configuration control. If the integration is paused/unavailable, show `AI Calling unavailable` with a concise non-technical message.

### B. KPI strip

Replace/extend the current metrics so the page immediately communicates outreach execution. Recommended Partner metrics:

1. `Due in 30 Days`
2. `Ready for AI Call`
3. `Follow-ups Due`
4. `Interested / Action Needed`

`In Policy Intake` remains valuable but can move to a compact conversion metric or secondary row if screen density requires it.

Never make provider-level technical metrics such as webhook failures, token usage, Sarvam balance or purchased-number state visible here.

### C. Primary work modes

Keep the business time windows (`Due`, `Follow-ups`, `Recently Expired`, `Future`) because they are useful operational slices.

Add an outreach filter group that supports states such as:

```text
All
Ready to Call
Queued
Calling
Connected
No Answer
Follow-up
Interested
Human Needed
Closed
```

Exact persisted state names must be finalized against the schema and webhook payload before implementation. Do not create UI-only pseudo-states that conflict with the database lifecycle.

### D. Compact AI Call control bar

Add a compact contextual action area above the worklist instead of a large banner.

Recommended elements:

- selection count
- `Call selected` primary action
- `Enrich missing details` secondary action only when applicable and authorized
- eligibility summary such as `12 ready · 3 need vehicle details · 2 suppressed`

Partner action should queue approved opportunity IDs through INSUREIT. It must **not** upload an arbitrary CSV directly to Sarvam and must not expose Sarvam campaign configuration.

For the earliest production slice, start with **single-opportunity call request or tightly bounded selected calls**, not unrestricted bulk campaigns.

### E. Worklist row redesign

Each opportunity row should make call readiness obvious without becoming visually heavy.

Recommended row hierarchy:

**Identity**
- customer/account name
- contact name/mobile if authorized

**Vehicle / policy context**
- registration or chassis reference
- make/model when known
- insurer/expiry when known

**Renewal timing**
- expiry date
- days left / overdue

**AI outreach state**
- readiness badge: `Ready`, `Needs details`, `Suppressed`, `Called`
- latest call/disposition badge
- last call time or next follow-up time

**Action**
- row opens detail workspace
- optional small phone/AI-call action only if the record is eligible and Partner has permission

Avoid turning every row into a mini dashboard or exposing raw transcript text in the list.

### F. Opportunity detail drawer/page

The existing `/partner/renewals/external/[id]` detail route should become the main operational workspace for a single opportunity.

Recommended sections:

1. **Renewal context** — known external policy/vehicle data
2. **Data readiness** — clearly distinguish `Source data`, `AuthBridge enriched`, and `Missing`
3. **AI outreach** — latest call state, disposition, summary, follow-up and human-handoff state
4. **Interaction timeline** — combine manual Partner interactions and AI calls in one chronological business history while preserving source/audit metadata internally
5. **Next action** — Call with AI, Call manually, Add follow-up, Start Policy Intake, or Close as appropriate

Raw provider configuration does not belong here.

### G. Selection and bulk safety

Bulk selection must be eligibility-aware. Suppressed, invalid, missing-phone or otherwise ineligible records should not be silently included.

Before creating a multi-call queue, show a concise review:

```text
Selected 20
Ready 16
Needs details 2
Do not contact 1
Invalid phone 1
```

Only the eligible set may continue. The system should never silently override suppression because a Partner selected `all`.

## 7. IT Super User administration design

Keep full controls in Development / IT Super User, separate from Partner operations.

Recommended future administration route grouping:

```text
Development
  Voice Agents
    ChatGPT Realtime Agent
    Sarvam Full Agent
    External Renewal Voice Workflow
```

The External Renewal Voice Workflow admin surface may eventually expose:

- active Sarvam agent/version reference
- outbound connection/number metadata
- default allowed call windows
- retry policy
- maximum concurrency / campaign limits
- integration pause switch
- webhook health and last delivery
- failed ingestion/replay tools
- AuthBridge enrichment health/cost controls
- prompt rollout/version history
- organization-wide call analytics

Every mutation must remain server-authorized for exact IT Super User / critical system-management access. Partner permissions must not be inferred from UI hiding.

## 8. Proposed data model — design first, migrate later

Do **not** overload the generic external-renewal interaction table with every provider-specific field. Keep business interaction history and provider attempt telemetry related but distinct.

Recommended logical entities, exact table names subject to schema review:

### `external_renewal_voice_queue`

Tracks an INSUREIT-approved request to call an external opportunity.

Candidate fields:

- queue/request id
- external opportunity id
- requested by
- request source (`partner_single`, `partner_selection`, `system_campaign`, `it_test`)
- eligibility snapshot/version
- status (`pending`, `enriching`, `ready`, `submitted`, `completed`, `blocked`, `cancelled`)
- scheduled/not-before time
- created/updated timestamps

### `external_renewal_voice_attempts`

One row per actual provider call attempt.

Candidate fields:

- attempt id
- queue id / opportunity id
- provider (`sarvam`)
- provider interaction/campaign/attempt identifiers
- agent/version reference
- caller connection reference without secrets
- connectivity result
- started/answered/ended timestamps
- duration
- final disposition
- interest level
- follow-up required/time
- objection/category when available
- concise call summary
- human-assistance flag
- ingestion status
- created/updated timestamps

Avoid storing provider secrets or raw audio. Raw transcript retention, if introduced, requires an explicit retention/access/privacy decision before schema implementation.

### enrichment snapshot/cache linkage

Prefer reusing the existing AuthBridge cache contract where possible. If external-opportunity-specific enrichment provenance is required, store normalized field provenance and lookup/cache reference rather than duplicating raw provider payloads.

## 9. Call eligibility state machine

Before a call can leave INSUREIT, evaluate at minimum:

```text
Opportunity active?
  -> yes
Valid mobile available?
  -> yes
Not already won/closed/renewed elsewhere?
  -> yes
Not do-not-contact/suppressed?
  -> yes
Within approved call window?
  -> yes
No duplicate active call request/attempt?
  -> yes
Enough context for approved greeting?
  -> yes OR generic-safe greeting path
Then: READY
```

AuthBridge enrichment is not automatically mandatory for every call. It should be invoked only if required data is missing and a usable registration number exists.

## 10. Sarvam integration contract

### Outbound submission

INSUREIT should eventually submit controlled call data programmatically. The production workflow must not depend on a Partner downloading/uploading cohort CSVs in Sarvam.

Provider payload construction must happen server-side from authorized opportunity IDs after re-running eligibility immediately before submission.

### Webhook ingestion

Create a dedicated server endpoint such as:

```text
/api/integrations/sarvam/voice-events
```

Exact path may change after inspecting Sarvam's current API contract.

Requirements:

- authenticate/verify the provider request using the strongest mechanism Sarvam supports
- reject malformed/unauthorized events
- idempotency on provider interaction/attempt/event identifiers
- never trust provider fields to authorize access or select arbitrary internal records
- map provider IDs only to pre-created INSUREIT call attempts
- persist business-safe output variables and connectivity state
- update the external renewal business lifecycle through a controlled server-side mapping
- never let duplicate webhook delivery create duplicate interactions/follow-ups
- capture ingest failure state without losing the provider attempt relationship
- keep logs free of unnecessary transcript/PII content

### Output-variable mapping

Sarvam output variables currently planned/tested include concepts such as:

- call disposition
- call summary
- customer interest
- follow-up required
- follow-up time
- customer objection

Before schema implementation, normalize these into stable INSUREIT enums and define how each updates the existing opportunity outcome/status model.

## 11. Business outcome mapping

Proposed mapping principle:

- `interested` -> external opportunity `interested`; human/quote next action
- `follow_up` -> external opportunity `follow_up`; persist requested follow-up when valid
- `not_interested` -> close/lost according to approved existing semantics
- `already_renewed` -> map to existing `renewed_elsewhere`
- `wrong_person` -> map to contact-data correction/invalid-contact workflow, not automatically lost without approved rule
- `human_assistance` -> keep opportunity active and create/flag human follow-up
- `no_decision` -> connected/neutral outcome; do not invent intent
- provider `no_answer` / busy / failed -> connectivity attempt, not a customer sales disposition

Exact DB transition rules must be reviewed against current RPCs/migrations before implementation.

## 12. Agent/tool behavior

The Sarvam agent must remain operationally truthful.

Until a real tool is connected and returns success, the agent must not claim it has:

- checked live quotations
- compared insurers
- calculated an exact premium/IDV/NCB
- sent WhatsApp/SMS/email
- scheduled a callback in INSUREIT
- updated CRM
- taken payment
- issued a policy

The first real INSUREIT tools should be narrow and server-authorized. Recommended order:

1. read approved external-opportunity context
2. record callback/follow-up preference
3. create human-assistance task/flag
4. later: quotation lookup when an authoritative quotation source exists
5. later: approved messaging action

Do not expose a generic arbitrary HTTP tool to the voice agent.

## 13. Consent, suppression and operational safeguards

Before real customer scale-up, define and enforce the legal/operational calling policy applicable to INSUREIT's context. The application must support, at minimum:

- do-not-contact suppression
- customer opt-out during a call
- approved call windows
- deduplication / attempt caps
- human escalation
- campaign pause/kill switch
- traceable agent/version used for each attempt
- partner-scope authorization
- provider and workflow audit events

Do not rely only on prompt instructions for suppression or authorization.

## 14. Observability and metrics

Partner page metrics should remain business-facing.

IT Super User metrics can include:

- requested / submitted / connected calls
- connection rate
- interested/follow-up/human-assistance rates
- no-answer/failed rates
- average duration
- webhook ingestion failures
- enrichment hit/cache/provider-call rates
- cost metrics when a reliable source exists
- agent version comparison

Do not use raw transcript contents as analytics dimensions.

## 15. Phased implementation plan

### Phase 0 — architecture freeze and UI plan

**Current target.**

- document workflow and boundaries
- inspect current external-renewal schema/RPCs and detail page
- inspect current Sarvam API/webhook/auth contract
- define permission/capability mapping
- define output-variable normalization
- define transcript retention decision
- finalize Partner UI wireframe before schema work

No production workflow changes.

### Phase 1 — Partner UI readiness, no live automated calling

- redesign `/partner/renewals/external` around call readiness and outreach states
- add detail-level Data Readiness / AI Outreach presentation
- preserve existing manual interactions and Policy Intake conversion
- add disabled/feature-gated AI call actions if backend is not live yet
- no secrets/client provider calls

Goal: make the business workflow understandable before connecting irreversible actions.

### Phase 2 — INSUREIT call queue + attempt schema

- migrations/RLS/RPCs for queue and attempts
- partner-scope and IT-admin authorization
- idempotency/duplicate-call guards
- suppression and call-window gates
- audit fields

Do not submit to Sarvam yet until schema and permissions are verified.

### Phase 3 — AuthBridge enrichment adapter

- server-only readiness/enrichment service for external opportunities
- reuse fresh cache
- strict field minimization
- no Customer/Vehicle/Policy master creation
- cost/duplicate-call controls

### Phase 4 — Sarvam outbound submission + webhook loop

- server-only provider client
- controlled single-call submission first
- webhook verification and idempotent ingestion
- output-variable mapping into existing renewal workflow
- failure/retry evidence
- IT Super User integration health

Start with internal/consented test numbers and synthetic opportunity data, then a very small approved live cohort.

### Phase 5 — controlled Partner calling

- enable authorized Partner `Call with AI` for eligible opportunities
- selected-call queue only after single-call path is proven
- review screen with ready/blocked/suppressed counts
- no arbitrary numbers/CSV upload
- monitor quality/cost/opt-outs

### Phase 6 — real INSUREIT tools

Only after the closed-loop call lifecycle is stable:

- callback scheduling/CRM action tool
- human assignment
- authoritative quote lookup
- messaging integration

Each tool needs its own authorization, audit, validation and failure contract.

## 16. Acceptance gates before any production customer campaign

Do not call the workflow production-ready until all of the following have direct evidence:

- Partner cannot access IT Super User administration
- Partner can only act on authorized external opportunities
- do-not-contact and invalid/missing mobile are hard-blocked server-side
- duplicate submissions are idempotently blocked
- AuthBridge lookup is server-only, minimized and credit-controlled
- Sarvam secrets never reach browser/client
- provider webhook authentication/verification is implemented
- duplicate webhook delivery is idempotent
- every call maps to exactly one known opportunity/attempt
- no-answer is not misclassified as customer rejection
- customer opt-out persists suppression
- call version/agent reference is auditable
- agent does not invent quote/premium/NCB/actions without tools
- integration can be paused by IT Super User
- failure paths leave recoverable state
- Partner list/detail remains usable if Sarvam or AuthBridge is unavailable
- canonical CI/migration/deployment verification is green for exact release state

## 17. Immediate next engineering step

Before writing migrations or live provider calls, perform a focused source audit of:

- current external renewal migrations/RPC definitions and RLS
- `/partner/renewals/external/[id]`
- Partner permission/capability resolution
- current AuthBridge cache/client interfaces
- current Sarvam official outbound-campaign API, webhook payload and webhook authentication options

Then produce the Phase 1 UI wireframe/spec and exact Phase 2 schema proposal for user approval.

Do **not** implement live Sarvam submission, webhook writes or database migrations merely from this planning document.

## 18. Continuity rule

Whenever material work in this integration is implemented, update this file with:

- branch/PR/merge commit
- exact evidence state (`IMPLEMENTED`, `MERGED`, `APPLIED`, `DEPLOYED`, `VERIFIED`, `BLOCKED`, `UNVERIFIED`)
- migrations/RPCs added
- provider contract/version assumptions
- access-control decisions
- call state/output mapping changes
- production verification evidence
- unresolved risks and next unlocked phase

Keep this document concise and current. Replace stale states instead of appending contradictory history.
