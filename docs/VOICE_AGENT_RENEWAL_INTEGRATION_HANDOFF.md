# INSUREIT Renewal Voice Agent Integration Handoff

> **Last updated:** 2026-09-13
>
> Source of truth for the INSUREIT External Renewal Opportunities -> Sarvam outbound voice-agent integration. Read this before changing Partner external-renewal AI outreach, Sarvam campaign/webhook integration, or voice-attempt schema.

## Evidence state

### Existing production/main business boundary — VERIFIED IN CURRENT MAIN

- External-renewal opportunities are isolated from verified INSUREIT Customers, Vehicles and Policies.
- Partner access is derived from authenticated `partner_app_commercial_scope()`; browser-supplied Partner identity is not authoritative.
- Manual CRM supports call, WhatsApp, note and follow-up interactions.
- Terminal opportunity states are `won`, `renewed_elsewhere`, `invalid_contact`, `do_not_contact`, and `lost`; terminal opportunities reject further CRM updates.
- Policy Intake is the conversion boundary. External opportunities become verified INSUREIT business only when the normal Policy Intake lifecycle produces a real final Policy.
- `won` is never a voice-agent outcome.

### Sarvam provider contract — VERIFIED FROM CURRENT OFFICIAL DOCS

- Stream Cohort API: `POST /api/scheduling/v1/orgs/:org_id/workspaces/:workspace_id/campaigns/:campaign_id/cohorts/stream`.
- A campaign must be Active, Scheduled, or Paused.
- One to 1000 users can be streamed; every user requires a phone number and may carry `user_identifier` plus configured agent variables.
- API authentication uses the server-side `api-subscription-key` header.
- Campaign webhooks are sent after every outbound attempt, connected or not.
- Webhook fields include `attempt_id`, `campaign_id`, `cohort_id`, `user_identifier`, completion/connectivity state, retry metadata, timestamps, output variables and transcript when connected.
- Current campaign-webhook docs do not document a cryptographic signature header. The first implementation therefore requires an INSUREIT-controlled webhook secret and validates the expected campaign/app. This has residual URL-secret risk if Sarvam is configured with a query-token URL; replace it with a provider-native signed mechanism if Sarvam adds one.

### Phase 2 feature branch — IMPLEMENTED, NOT MERGED / NOT APPLIED / NOT DEPLOYED

Branch: `feat/external-renewal-sarvam-phase2`

The branch now contains the first single-opportunity closed-loop foundation:

- isolated voice-attempt schema
- retry-safe provider-attempt event/idempotency schema
- Partner-scoped call-start RPC
- service-role submission/result RPCs
- server-only Sarvam Stream Cohort client
- Partner `Call with AI` route
- hardened Sarvam outbound webhook route
- deterministic CRM projection
- Partner detail-page AI Outreach control/status
- external-renewal worklist AI status badge/projection
- dedicated protected schema workflow
- production schema gate entry
- focused Partner external-renewal voice regression
- nested `apps/web-portal/app/partner/renewals/external/AGENTS.md` requiring this handoff for relevant future work

Nothing in this section is production evidence until the PR is merged, migrations are applied by the protected workflow, Vercel deployment is completed, provider environment is configured, and a controlled real call is verified end to end.

## Durable architecture

INSUREIT owns workflow state. Sarvam is the conversation/telephony provider. AuthBridge is an enrichment provider only.

```text
External Renewal Opportunity
  -> Partner explicit Call with AI
  -> authenticated Partner scope + eligibility checks
  -> local INSUREIT voice attempt UUID
  -> Sarvam Stream Cohort (local attempt UUID as user_identifier)
  -> outbound call
  -> Sarvam campaign webhook
  -> INSUREIT webhook validation + idempotency
  -> normalized voice result
  -> external renewal CRM interaction/state
  -> human follow-up / Policy Intake when appropriate
```

Do not correlate a result by phone number. The local INSUREIT attempt UUID is created first and sent to Sarvam as `user_identifier`.

## Role boundary

### Partner may see/use

- AI outreach availability/status
- `Call with AI` for one eligible external opportunity
- queued/calling/connected/no-answer/busy/failed/follow-up/interested/human-needed state
- concise normalized call summary and follow-up information
- normal manual CRM actions and Policy Intake conversion actions

### Partner must never receive

- Sarvam API key
- telephony credentials
- webhook secret
- org/workspace/campaign administration
- agent/version controls
- caller-number/retry/concurrency/call-window controls
- raw provider payloads
- raw transcripts by default

### IT Super User owns

- approved Sarvam agent/version
- approved outbound campaign
- managed telephony/caller number
- retry/call-window/concurrency policy
- integration enable/disable control
- webhook/provider configuration
- diagnostics and future failed-event replay tools

The current first slice uses server environment configuration for this control plane. A dedicated in-app IT Super User administration surface may be added later; Partner pages must not gain these controls.

## Current external-renewal data boundary

### `external_renewal_import_batches`

Source import metadata is Partner-isolated. Published batches are the only source eligible for Partner workflow reads.

### `external_renewal_opportunities`

Important existing rules:

- `policy_start_date = invoice_date`
- `policy_end_date = invoice_date + 1 calendar year`
- no FK to verified `customers`, `vehicles`, `policies`
- direct authenticated table access revoked
- Partner-scoped RPC access only
- `do_not_contact` and terminal states must never be called

### `external_renewal_interactions`

Business CRM history remains separate from provider telemetry. AI calls create a normal CRM interaction only after a connected call has a validated normalized outcome.

### `external_renewal_voice_attempts` — Phase 2

Parent dispatch/lifecycle record for one explicit Partner AI call request. Stores only normalized provider identifiers/status/result fields required by the workflow. It does not store raw webhook JSON or raw transcript.

Key invariants:

- composite opportunity/Partner FK
- one active attempt per opportunity
- direct `authenticated` table privileges revoked
- service-role result writes only
- Partner starts through scoped RPC

### `external_renewal_voice_attempt_events` — Phase 2

Minimal per-Sarvam-attempt event table. Sarvam may retry one streamed cohort user and sends a different `attempt_id` for each provider call attempt. This child table makes webhook delivery retry-safe and keeps `provider_attempt_id` unique/idempotent without losing provider retry history.

No raw transcript is stored.

## Phase 2 server/API contract

### Partner call action

`POST /api/partner/external-renewals/[id]/voice-call`

Flow:

1. requires the existing Partner web session
2. rejects the request if `SARVAM_RENEWAL_CALLING_ENABLED` is not explicitly `true`
3. starts the attempt through `partner_app_start_external_renewal_voice_attempt(...)`
4. database rechecks Partner commercial scope, published/active opportunity, terminal/DNC state, mobile presence and duplicate active attempt
5. server normalizes the Indian mobile number
6. server streams one Sarvam cohort user
7. `user_identifier = local INSUREIT attempt UUID`
8. only configured/known renewal variables are sent; missing values are omitted rather than invented
9. server records campaign/cohort submission through service-role RPC

If Sarvam definitely rejects the request, the local attempt is failed/released. If Sarvam accepted the cohort but INSUREIT persistence then fails, the attempt is deliberately left active rather than falsely released; the webhook can still reconcile using `user_identifier`.

### Sarvam campaign webhook

`POST /api/integrations/sarvam/voice-campaign-webhook`

Current first-slice safeguards:

- requires `SARVAM_RENEWAL_WEBHOOK_SECRET` through supported header or configured URL query token
- rejects unexpected `SARVAM_RENEWAL_CAMPAIGN_ID`
- optionally rejects unexpected `SARVAM_RENEWAL_APP_ID`
- requires a UUID-shaped `user_identifier`
- validates known completion/connectivity/disposition values
- limits declared payload size
- never logs provider/customer payloads
- ignores transcript for persistence
- accepts follow-up timestamps only when explicit ISO-8601 timezone information is present; natural-language callback times are not guessed
- writes through the service-role result RPC

## Server environment contract

Secrets/configuration stay server-side. Do not expose them with `NEXT_PUBLIC_` names.

- `SARVAM_API_KEY` — secret API subscription key
- `SARVAM_ORG_ID` — provider organization ID
- `SARVAM_WORKSPACE_ID` — provider workspace ID
- `SARVAM_RENEWAL_CAMPAIGN_ID` — IT-approved outbound campaign
- `SARVAM_RENEWAL_APP_ID` — optional expected agent/app ID for webhook binding
- `SARVAM_RENEWAL_WEBHOOK_SECRET` — high-entropy INSUREIT webhook secret until provider-native signing is available
- `SARVAM_RENEWAL_CALLING_ENABLED` — explicit kill switch; only literal `true` enables Partner outbound submission

Never put actual values in repository files.

## Agent-variable contract

Input variables currently sent only when known:

- `customer_name`
- `vehicle_make_model`
- `vehicle_number`
- `current_insurer`
- `policy_expiry_date`
- `previous_idv`
- `previous_premium`

External opportunities often do not contain IDV/premium. Missing fields must remain missing; the agent must not infer them.

Expected output variables:

- `call_disposition`
- `customer_interest`
- `follow_up_required`
- `call_summary`
- optional `follow_up_time`
- optional `customer_objection`

Before production activation, the committed Sarvam agent version must support the dispositions used by the integration, especially explicit opt-out (`do_not_contact`). If the current committed Sarvam version does not expose that output, create/verify a new controlled version before enabling real Partner calls.

## Deterministic CRM result mapping

Provider connectivity is authoritative before conversational disposition.

| Provider/agent result | INSUREIT result |
| --- | --- |
| failed / no answer / busy with retry pending | provider event only; parent remains queued; no CRM sales outcome |
| failed / no answer / busy terminal | parent attempt failed; no Connected/Interested CRM outcome |
| connected + no clear decision | `connected` |
| connected + interested | `interested` |
| connected + explicit quote request | `quote_requested` |
| connected + follow-up + valid future timezone-aware timestamp | `follow_up` |
| follow-up request without safely parseable future timestamp | `connected`; human scheduling required |
| already renewed elsewhere | `renewed_elsewhere` |
| explicit opt-out / stop calling | `do_not_contact` |
| wrong person | `connected` in first slice; human review required, not auto-terminal |
| simple not-interested | `connected` in first slice; human review required, not auto-lost |
| requests human assistance | `connected` + human-needed worklist state |

`won` is prohibited from the voice result function.

## Partner UI contract

### Worklist `/partner/renewals/external`

The page remains a business worklist, not a Sarvam admin console.

Current Phase 2 branch changes:

- heading reframed to **Renewal outreach**
- compact AI renewal-outreach strip explains that calls are controlled per opportunity
- rows show a compact AI state beside the existing CRM status
- AI state is obtained through one Partner-scoped batch RPC for the current page, not N per-row provider/database requests
- no bulk call button
- no campaign/provider configuration

### Detail `/partner/renewals/external/[id]`

Adds a compact **AI Outreach** section while preserving manual CRM and Policy Intake controls.

Possible normalized states include:

- Available
- Queued
- Calling
- Connected
- Interested
- Follow-up
- Human Needed
- No Answer
- Busy
- Failed
- Needs Details
- Closed

`Call with AI` appears only when the server-side integration is enabled, the opportunity is non-terminal, a mobile exists, and no active AI attempt is present.

## AuthBridge boundary

AuthBridge enrichment is deliberately **not part of the first closed-loop Sarvam slice**.

When added later:

- server-side only
- controlled trigger, not on every keystroke/page render
- cache-first where available
- use only fields actually returned by the verified provider contract
- enrich the external opportunity context only
- never silently create/update verified Customers, Vehicles or Policies
- do not bulk-spend provider credits across the whole worklist merely because rows are visible

## Safety/eligibility gates before production activation

Current code already enforces technical eligibility: active/published scoped opportunity, non-terminal/non-DNC, mobile present, no active duplicate attempt, integration kill switch.

Before enabling `SARVAM_RENEWAL_CALLING_ENABLED=true` for real customer outreach, INSUREIT must also finalize and verify its operational eligibility rule for consent/DND/contact policy and campaign calling hours. Presence of a phone number alone is not authorization to market by automated call.

Do not describe the feature as production-ready until that rule and provider configuration have been verified.

## Regression contract

`apps/web-portal/scripts/partner-external-renewal-voice-regression.mjs` is pulled into the existing Partner external-renewal CRM regression and therefore into the canonical Partner web verification gate.

It protects at least:

- Partner-scope derivation
- DNC/terminal guard presence
- one-active-attempt invariant
- provider retry idempotency
- explicit opt-out mapping
- simple decline/wrong-person not becoming automatic terminal outcomes
- no AI `won`
- connected-only CRM projection
- future timestamp requirement for AI follow-up
- server-only Sarvam key
- local attempt UUID as provider correlation key
- IT kill switch
- webhook secret + expected campaign binding
- no transcript persistence path
- no verified Customer/Vehicle/Policy writes

## Protected schema release

Phase 2 uses two migrations. The Partner worklist projection RPC is intentionally folded into the second migration so the release has one coherent protected schema gate rather than an unnecessary third migration:

- `20260913220500_external_renewal_voice_attempts.sql`
- `20260913221500_external_renewal_voice_result_projection.sql`

Dedicated workflow:

- `.github/workflows/apply-external-renewal-voice-attempts.yml`

Production deployment gate:

- `.github/workflows/deploy-production.yml` must recognize both Phase 2 voice migrations and wait for the dedicated schema workflow before Vercel.

A committed migration is **not APPLIED**. A merged PR is **not DEPLOYED**.

## Explicitly deferred after this slice

- bulk/select-many AI calling
- scheduled autonomous campaigns from INSUREIT
- automatic AuthBridge enrichment
- live quote API/tool use
- automatic WhatsApp or payment links
- transcript retention/search
- human call transfer
- automatic Policy Intake creation
- Partner access to provider administration
- in-app IT Super User campaign/version/telephony editor

## Next safe continuation

1. open the Phase 2 PR and complete exact-head CI
2. inspect/fix any typecheck, regression, lint or build failures
3. do not merge until the user explicitly asks
4. after merge, confirm protected schema application before any production portal deployment
5. keep `SARVAM_RENEWAL_CALLING_ENABLED` off until server secrets/config, Sarvam campaign webhook URL, agent output variables and operational outreach eligibility are verified
6. first live verification must be a controlled single opportunity, then inspect provider attempt event, CRM projection, UI state and follow-up behavior before considering bulk calling
