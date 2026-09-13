# INSUREIT Renewal Voice Agent Integration Handoff

> **Prepared:** 2026-09-13
>
> This handoff records the verified Phase 1 architecture for connecting INSUREIT external-renewal opportunities to a future Sarvam outbound voice-agent workflow. It is deliberately documentation-only. It does **not** authorize live outbound calls, production schema changes, customer-data enrichment, telephony activation, or automatic CRM writes.

## Current evidence state

- **VERIFIED IN CURRENT `main`:** external-renewal opportunities are stored in isolated tables and remain separate from verified INSUREIT Customers, Vehicles and Policies.
- **VERIFIED IN CURRENT `main`:** Partner reads/writes go through authenticated, Partner-scoped security-definer RPCs; authenticated browser clients do not receive direct table privileges on the isolated external-renewal tables.
- **VERIFIED IN CURRENT `main`:** manual CRM interaction history already supports call, WhatsApp, note and follow-up interaction types.
- **VERIFIED IN CURRENT `main`:** terminal external-renewal outcomes are `won`, `renewed_elsewhere`, `invalid_contact`, `do_not_contact` and `lost`; terminal opportunities reject further CRM updates.
- **VERIFIED IN CURRENT `main`:** Policy Intake is the normal conversion boundary. External opportunities are not counted as verified INSUREIT business until a linked Policy Intake produces a real final Policy.
- **VERIFIED IN CURRENT `main`:** reporting uses CRM history for contacted/connected/quote funnel stages and uses verified final-policy premium only for converted premium.
- **PROVIDER-CONTRACT VERIFIED FROM CURRENT SARVAM DOCUMENTATION:** outbound campaign webhooks can POST one event after every campaign call attempt, including connected and failed attempts, with attempt/campaign/cohort IDs, connectivity/completion state, timestamps, retry data, variables and transcript when available.
- **NOT IMPLEMENTED:** INSUREIT does not yet create Sarvam campaigns from Partner external-renewal records, accept Sarvam campaign webhooks, or map Sarvam call results into the external-renewal CRM.

## Current INSUREIT external-renewal data boundary

### `external_renewal_import_batches`

Source-level import metadata is isolated by Partner. Batch states are `draft`, `validated`, `published`, and `archived`.

### `external_renewal_opportunities`

The opportunity snapshot contains the imported customer/contact/vehicle/current-policy fields used only for retargeting. Important rules:

- `policy_start_date = invoice_date`
- `policy_end_date = invoice_date + 1 calendar year`
- no foreign key to verified `customers`, `vehicles`, or `policies`
- direct authenticated access is revoked
- opportunities are Partner-scoped through `partner_app_commercial_scope()`
- `do_not_contact` is already a terminal state and must never be selected for automated outreach

### `external_renewal_interactions`

Manual CRM history currently records:

- interaction type: `call`, `whatsapp`, `note`, `follow_up`
- outcome: `contact_attempted`, `connected`, `interested`, `quote_requested`, `quote_shared`, `follow_up`, `renewed_elsewhere`, `invalid_contact`, `do_not_contact`, `lost`
- note
- optional follow-up timestamp
- authenticated actor ID and creation timestamp

The write RPC rejects a follow-up date for terminal outcomes and rejects all further CRM updates after an opportunity reaches a terminal state.

## Partner authorization model to preserve

The current Partner web layer calls `getPartnerWebSession()` before invoking the external-renewal RPCs. The database RPCs then derive the allowed Partner IDs from `partner_app_commercial_scope()` and only operate on published, active opportunities inside that scope.

A future AI-calling implementation must preserve that same commercial-scope boundary. Do not let a browser-provided `partner_id`, phone number, opportunity ID, campaign ID, or webhook payload become the authority for Partner ownership.

## Sarvam outbound webhook contract relevant to INSUREIT

Current Sarvam Voice Agents campaign documentation states that after every outbound call attempt, whether connected or not, Sarvam can POST a campaign webhook event. The payload includes identifiers and status such as:

- `app_id`, `app_version`
- `attempt_id`
- `campaign_id`, `cohort_id`
- `completion_status`: `completed`, `partial`, `failed`
- `connectivity_status`: `connected`, `busy`, `no_answer`, `failed`, or null
- user/agent phone numbers
- duration and call timestamps
- retry attempt / next action metadata when supplied
- `initial_agent_variables`
- `final_agent_variables`
- `output_agent_variables`
- `interaction_transcript` when connected
- optional webhook metadata

Sarvam output variables are extracted after a call from the conversation. For the current INSUREIT benchmark agent, the intended structured outputs are:

- `call_disposition`
- `customer_interest`
- `follow_up_required`
- `call_summary`
- optional `follow_up_time`
- optional `customer_objection`

Do not make the transcript the primary CRM state. Prefer validated structured output variables plus provider connectivity status; retain transcript only if an approved retention/privacy design explicitly requires it.

## Phase 2 target architecture

The next implementation should be additive and use four layers:

1. **Partner action layer**
   - eligible external-renewal rows expose an explicit AI-call action only to authorized Partner users
   - no automatic/bulk calling in the first implementation
   - user deliberately starts one call for one opportunity

2. **Server orchestration layer**
   - server re-fetches the opportunity through the authenticated Partner scope
   - validates eligibility and terminal/do-not-contact guards
   - creates the Sarvam outbound call/campaign request server-side
   - passes only the minimum required agent variables
   - stores provider identifiers without exposing provider secrets to the browser

3. **Webhook ingestion layer**
   - dedicated server endpoint accepts Sarvam completion events
   - validates provider authenticity using the strongest mechanism Sarvam supports for the selected deployment; if Sarvam does not provide a cryptographic signature, use a high-entropy unguessable endpoint/relay secret or gateway control and document the residual risk before production
   - treats `attempt_id` as the idempotency key
   - validates that campaign/attempt metadata maps to the expected INSUREIT opportunity and Partner
   - never trusts a webhook-supplied Partner identity as the database authority

4. **CRM projection layer**
   - writes a normalized AI-call attempt/history record first
   - then, only through a database-owned mapping function, updates the external-renewal opportunity and/or creates a CRM interaction
   - terminal-state and do-not-contact guards remain authoritative in the database

## Recommended additive Phase 2 schema

Do **not** overload `external_renewal_interactions` with provider-delivery state. Add a separate attempt table, for example `external_renewal_voice_attempts`, with a minimal contract:

- `id uuid`
- `opportunity_id uuid`
- `partner_id uuid`
- `provider text` constrained initially to `sarvam`
- `provider_app_id text`
- `provider_campaign_id text`
- `provider_cohort_id text`
- `provider_attempt_id text` unique
- `provider_interaction_id text`
- `connectivity_status text`
- `completion_status text`
- `retry_attempt integer`
- `duration_seconds numeric`
- `started_at timestamptz`
- `ended_at timestamptz`
- `call_disposition text`
- `customer_interest text`
- `follow_up_required boolean`
- `follow_up_at timestamptz`
- `customer_objection text`
- `call_summary text`
- `provider_payload_version integer`
- `created_at`, `updated_at`

Avoid storing raw transcript, raw full webhook JSON, or unnecessary phone/identity duplication by default. If later business requirements need transcripts, define retention, visibility, masking and deletion rules first.

## Proposed deterministic result mapping

The provider output must not directly invent INSUREIT status. Normalize it through a strict mapping table/function.

| Sarvam/agent result | INSUREIT CRM result |
| --- | --- |
| call failed / no answer / busy | keep opportunity non-terminal; record attempt only; do not mark connected |
| connected but no clear decision | `connected` |
| `interested` | `interested` |
| clear request for quote | `quote_requested` |
| customer asks to call later | `follow_up` only when a valid future follow-up time exists; otherwise record connected/no-decision and require human scheduling |
| already renewed elsewhere | `renewed_elsewhere` |
| wrong/invalid number | `invalid_contact` |
| explicit opt-out / stop calling | `do_not_contact` |
| clear decline without opt-out | `lost` only if the approved business rule treats that call as final; otherwise preserve non-terminal state for human review |
| requests human assistance | do not invent a sales outcome; flag for human handling |

`won` must never come directly from the voice agent. Existing INSUREIT conversion logic remains authoritative: Won occurs only when the normal linked Policy Intake produces a real final Policy.

## Eligibility gates before any outbound call

Phase 2 must enforce all of the following server-side before creating a Sarvam call:

- opportunity exists and is active
- import batch is published
- opportunity belongs to the authenticated Partner commercial scope
- status is not `won`, `renewed_elsewhere`, `invalid_contact`, `do_not_contact`, `lost`, or `duplicate`
- mobile number is present and passes the approved normalization/validation rule
- no active duplicate call attempt exists for the same opportunity
- any DND/consent/business-hour controls approved by INSUREIT are satisfied

Do not derive calling permission merely from the presence of a phone number in imported data.

## Browser and secret boundary

- Sarvam API keys, telephony credentials and webhook secrets stay server-side only.
- The Partner browser should receive only the normalized call state needed for the UI.
- Never log secrets, raw provider authorization headers or full customer transcripts.
- The existing IT Super User Sarvam browser benchmark remains separate from this Partner production workflow.

## Phase 2 UI specification

On the external-renewal detail page, add one compact **AI Call** control near the existing CRM actions. First implementation should be single-opportunity only.

Recommended states:

- `Call with AI`
- `Starting…`
- `Calling`
- `Connected`
- `Completed`
- `No answer`
- `Busy`
- `Failed`
- `Follow-up scheduled`

Show the latest normalized result and summary in the existing interaction/history area. The operator must still be able to record a normal manual interaction.

Do not add bulk campaign controls until the single-call lifecycle, idempotency, outcome mapping, opt-out handling and webhook recovery path have been proven.

## Phase 2 API/RPC shape

Suggested server/API boundary:

- `POST /api/partner/external-renewals/[id]/voice-call`
  - authenticated Partner action
  - rechecks eligibility/scope
  - creates the provider call/campaign request
  - inserts pending attempt record

- `POST /api/integrations/sarvam/voice-campaign-webhook`
  - provider callback only
  - validates provider authenticity and schema
  - idempotent by `attempt_id`
  - calls a database RPC to apply the normalized result

Suggested database-owned RPCs:

- `partner_app_start_external_renewal_voice_attempt(...)`
- `apply_external_renewal_voice_result(...)` restricted to service role/server integration path

The apply RPC should lock the opportunity/attempt rows, reject stale/duplicate terminal transitions, update the attempt, and create/update CRM state atomically.

## Required tests before merge of Phase 2

At minimum, regression coverage must prove:

- cross-Partner opportunity IDs cannot start calls
- browser-supplied Partner identity is ignored
- terminal and do-not-contact opportunities cannot start calls
- provider duplicate webhook delivery is idempotent
- failed/no-answer calls do not become connected/interested
- follow-up requires a valid future time
- AI result cannot set `won`
- external-renewal data remains isolated from verified Customers/Vehicles/Policies
- authenticated users still cannot directly read/write provider attempt tables
- no provider secret is present in client bundles or browser responses

## Explicitly deferred

The following are **not** authorized by this Phase 1 handoff:

- live outbound Sarvam telephony from Partner Portal
- bulk or scheduled campaigns
- automatic quote generation
- automatic WhatsApp/payment links
- production schema migration
- transcript retention
- direct writes into verified Customer/Vehicle/Policy masters
- AuthBridge enrichment of imported external-renewal records
- automatic Policy Intake creation
- human call transfer

## Next safe step

Implement Phase 2 as a separate feature branch and PR only after the user explicitly approves live Partner-to-Sarvam integration work. Keep the first slice to **one explicit AI call per selected opportunity**, with additive attempt storage, a hardened webhook, deterministic status mapping and no bulk calling.
