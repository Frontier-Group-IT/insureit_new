# INSUREIT Renewal Voice Agent Integration Handoff

> **Last updated:** 2026-09-18
>
> Source of truth for INSUREIT External Renewal Opportunities -> Sarvam outbound voice-agent integration. Read this before changing Partner external-renewal AI outreach, Sarvam campaign/webhook integration, voice-attempt schema, or the IT Super User voice-integration readiness area.

## Current evidence state

### Production foundation — MERGED + APPLIED + DEPLOYED

PR #1779 (`Add controlled Sarvam AI renewal calling`) merged to `main` as:

`2d64414422dc28700d28c38ac793f17bdc181f17`

Evidence:

- canonical `Verify web portal` run `34770392062` — **VERIFIED / SUCCESS**
- dedicated schema workflow `34770749149` — **APPLIED + VERIFIED / SUCCESS**
- production deploy workflow `34770749138` — **DEPLOYED / SUCCESS**
- Vercel production deployment `dpl_BU9PYzigk5RR3Uf4Zz9fYmfMpMhp` — **READY**
- production alias includes `https://portal.insureit.in`

The protected schema workflow confirmed the voice attempt/event tables and Partner/service-role RPC contract in the production Supabase project before Vercel deployment proceeded.

### Production single-opportunity calling state — VERIFIED END TO END

The single-opportunity Partner-triggered AI calling lifecycle is now verified in production for controlled internal tests.

Verified on 2026-09-18:

- production Sarvam scheduling authentication works with `X-API-Key`
- Partner `Call with AI` creates one local attempt and one streamed cohort user
- API-created cohort execution produced successful live PSTN calls
- Sarvam agent v4 returned structured output variables
- the campaign webhook successfully reached INSUREIT after the webhook URL was actually saved on the campaign
- provider attempt/idempotency event creation succeeded
- normalized result projection updated the External Renewal opportunity and Partner UI
- a missing-webhook first trial was reconciled through the existing `apply_external_renewal_voice_result(...)` contract after provider-export evidence proved completion
- no verified Customer, Vehicle or Policy master was used as the projection target

Detailed evidence and failed/successful trial chronology:
`docs/SARVAM_CONTROLLED_LIVE_TEST_2026_09_18.md`.

Important limitation: this verifies the **single-opportunity closed loop only**. Bulk calling, autonomous scheduling, production calling-hour/DND policy, monitoring, stale-attempt reconciliation automation, and scaled campaign controls are not yet production-approved.

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

Never correlate a call result by phone number. INSUREIT creates the local attempt UUID first and sends it to Sarvam as `user_identifier`.

## Business boundary

External Renewal Opportunities remain isolated from verified INSUREIT Customers, Vehicles and Policies.

- Partner access derives from authenticated `partner_app_commercial_scope()`.
- Browser-supplied Partner identity is not authoritative.
- Terminal states are `won`, `renewed_elsewhere`, `invalid_contact`, `do_not_contact`, and `lost`.
- `won` is never a voice-agent outcome.
- Policy Intake is the only conversion boundary from an external opportunity into verified INSUREIT business.
- The voice integration must never create or update verified Customer, Vehicle or Policy masters directly.

## Production schema

### `external_renewal_voice_attempts`

Parent dispatch/lifecycle record for one explicit Partner AI call request.

Key invariants:

- composite opportunity/Partner FK
- one active attempt per opportunity
- direct authenticated table privileges revoked
- Partner starts through scoped RPC
- provider/result writes are service-role controlled
- normalized provider identifiers/status/result fields only
- no raw webhook payload or transcript storage

### `external_renewal_voice_attempt_events`

Minimal per-provider-attempt retry/idempotency history.

Sarvam may retry one streamed cohort user and produce a distinct provider `attempt_id` for each call attempt. `provider_attempt_id` is unique so duplicate webhook delivery cannot create duplicate CRM outcomes.

### Production migrations

- `20260913220500_external_renewal_voice_attempts.sql`
- `20260913221500_external_renewal_voice_result_projection.sql`

Dedicated protected workflow:

- `.github/workflows/apply-external-renewal-voice-attempts.yml`

Production deployment gate:

- `.github/workflows/deploy-production.yml` waits for this schema workflow when either migration is present in the release.

## Partner call contract

Endpoint:

`POST /api/partner/external-renewals/[id]/voice-call`

Flow:

1. existing Partner session is required
2. `SARVAM_RENEWAL_CALLING_ENABLED` must be literal `true`
3. database rechecks Partner commercial scope
4. opportunity must be published, active, non-terminal and not DNC
5. mobile must normalize to a valid Indian phone number
6. no duplicate active AI attempt may exist
7. INSUREIT creates a local attempt UUID
8. one Sarvam cohort user is streamed
9. `user_identifier = local attempt UUID`
10. only known variables are sent; missing premium/IDV/etc. remain missing
11. accepted campaign/cohort identifiers are persisted through service-role RPC

If Sarvam definitely rejects the request, the local attempt may be failed/released. Timeout/network ambiguity is intentionally treated as possibly accepted: the local attempt remains protected to avoid duplicate calls until webhook/reconciliation resolves it.

## Sarvam webhook contract

Endpoint:

`POST /api/integrations/sarvam/voice-campaign-webhook`

Safeguards:

- requires `SARVAM_RENEWAL_WEBHOOK_SECRET` through the supported header or configured URL query token
- rejects unexpected `SARVAM_RENEWAL_CAMPAIGN_ID`
- may additionally reject unexpected `SARVAM_RENEWAL_APP_ID`
- requires UUID-shaped `user_identifier`
- validates known completion/connectivity/disposition values
- uses provider `attempt_id` idempotently
- limits declared payload size
- never logs provider/customer payloads
- does not persist transcript
- accepts follow-up timestamps only when explicit timezone-aware ISO-8601 timestamps are supplied
- writes through service-role result RPC

Current Sarvam campaign webhook docs do not document a cryptographic signature header. INSUREIT therefore uses a high-entropy application-controlled webhook secret plus campaign/app binding. Replace this with provider-native signed verification if Sarvam adds one.

## Server environment contract

Secrets/configuration stay server-side. Never expose these through `NEXT_PUBLIC_` variables.

Required for a controlled live test:

- `SARVAM_API_KEY`
- `SARVAM_ORG_ID`
- `SARVAM_WORKSPACE_ID`
- `SARVAM_RENEWAL_CAMPAIGN_ID`
- `SARVAM_RENEWAL_WEBHOOK_SECRET`

Recommended binding:

- `SARVAM_RENEWAL_APP_ID`

Kill switch:

- `SARVAM_RENEWAL_CALLING_ENABLED`

Only literal `true` permits Partner outbound submission.

Never put actual secret values in repository files, chat handoffs, logs or UI.

## Agent variable contract

Input variables are sent only when known:

- `customer_name`
- `vehicle_make_model`
- `vehicle_number`
- `current_insurer`
- `policy_expiry_date`
- `previous_idv`
- `previous_premium`

Expected output variables:

- `call_disposition`
- `customer_interest`
- `follow_up_required`
- `call_summary`
- optional `follow_up_time`
- optional `customer_objection`

The committed Sarvam agent version must expose the dispositions used by INSUREIT, especially explicit opt-out (`do_not_contact`). Missing fields must never be invented by the agent.

## Deterministic CRM mapping

Provider connectivity is authoritative before conversational disposition.

| Provider/agent result | INSUREIT result |
| --- | --- |
| busy / no answer / failed with retry pending | provider event only; parent remains queued |
| terminal busy / no answer / failed | parent attempt failed; no sales outcome |
| connected + no clear decision | `connected` |
| connected + interested | `interested` |
| connected + quote request | `quote_requested` |
| connected + follow-up + valid future timezone-aware timestamp | `follow_up` |
| follow-up without safe future timestamp | `connected`; human scheduling required |
| already renewed elsewhere | `renewed_elsewhere` |
| explicit opt-out / stop calling | `do_not_contact` |
| wrong person | `connected` + human review in first slice |
| simple not interested | `connected` + human review in first slice |
| human assistance | `connected` + human-needed worklist state |

`won` is prohibited from the voice result function.

## Partner UI contract

### `/partner/renewals/external`

This remains a business worklist, not a Sarvam console.

- compact AI outreach state only
- batched Partner-scoped voice-state RPC
- no provider configuration
- no campaign administration
- no bulk AI calling yet

### `/partner/renewals/external/[id]`

Contains the first-slice single-opportunity `Call with AI` action and latest normalized AI result.

Possible states include:

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

The action remains hidden/blocked when the server kill switch is off, the opportunity is terminal/DNC, the mobile is unusable, or an active AI attempt already exists.

## IT Super User readiness area

Follow-up branch `feat/voice-integration-readiness` introduces a protected read-only operational readiness page at:

`/system/voice-integration`

Design rules:

- exact `it_super_user` role required
- `manage_system` at `approve` access also required
- reports production schema reachability
- reports presence/missing state of server configuration without rendering secrets
- may show masked non-secret provider identifier hints
- reports kill-switch state
- shows the canonical webhook endpoint
- shows recent attempt statuses without customer identity, phone number, transcript or raw provider payload
- does not itself enable calling or edit provider configuration

This page is an IT operational surface only. Partner users must never receive these controls or diagnostics.

## AuthBridge boundary

AuthBridge enrichment is intentionally deferred until the base voice lifecycle is proven end to end.

When added:

- server-side only
- controlled trigger
- cache-first
- no automatic spend across visible worklist rows
- approved normalized fields only
- external-opportunity enrichment only
- never silently create/update verified Customers, Vehicles or Policies

## Production activation gate

Before enabling real customer calls at scale, verify all of the following:

1. Sarvam API/org/workspace/campaign configuration is present server-side.
2. The approved campaign is Active/Scheduled/Paused as required by the Stream Cohort contract.
3. The campaign webhook points to `https://portal.insureit.in/api/integrations/sarvam/voice-campaign-webhook` and supplies the INSUREIT webhook secret by the configured mechanism.
4. The committed agent version uses the approved INSUREIT identity/prompt and output variables.
5. Explicit opt-out maps to `do_not_contact`.
6. Approved calling hours/contact-policy/DND handling are in force.
7. `SARVAM_RENEWAL_CALLING_ENABLED=true` is enabled intentionally only for the controlled test window.
8. One selected External Renewal opportunity is called.
9. Verify local parent attempt + provider attempt event.
10. Verify webhook ingestion is idempotent.
11. Verify Partner UI state and CRM interaction mapping.
12. Re-disable the kill switch if any provider/webhook/CRM inconsistency appears.

Do not begin bulk calling after only one successful PSTN connection. The whole INSUREIT closed loop must be verified.

## Regression contract

`apps/web-portal/scripts/partner-external-renewal-voice-regression.mjs` runs inside the canonical Partner web verification path and protects:

- Partner scope derivation
- terminal/DNC guard
- one-active-attempt invariant
- provider retry idempotency
- explicit opt-out mapping
- no AI `won`
- connected-only CRM outcomes
- safe future follow-up timestamps
- server-only provider credentials
- local attempt UUID correlation
- kill switch
- webhook campaign/secret binding
- no transcript persistence
- no verified master writes
- IT Super User readiness role boundary when that page is present

## Deferred until post-single-call production hardening

- bulk/select-many AI calling
- scheduled autonomous campaigns from INSUREIT
- automatic AuthBridge enrichment
- quote API/tool use
- automatic WhatsApp or payment links
- transcript retention/search
- human call transfer
- automatic Policy Intake creation
- Partner provider administration
- editable in-app Sarvam campaign/version/telephony controls

## Next safe continuation

1. merge/deploy the IT Super User readiness page only after canonical CI succeeds and user explicitly approves
2. use that page to confirm which production configuration values are present without exposing secrets
3. configure missing Sarvam production values outside the repository
4. verify the campaign webhook and committed agent output variables
5. approve the operational DND/contact/calling-window rule
6. enable the kill switch only for one controlled External Renewal opportunity
7. inspect the full INSUREIT -> Sarvam -> webhook -> CRM -> Partner UI lifecycle before any bulk-calling work
