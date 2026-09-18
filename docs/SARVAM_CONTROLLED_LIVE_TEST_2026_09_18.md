# Sarvam Controlled Live Voice Test — 2026-09-18

> Durable execution record for the first end-to-end INSUREIT External Renewal -> Sarvam live telephony tests.
>
> Read together with:
> - `docs/VOICE_AGENT_RENEWAL_INTEGRATION_HANDOFF.md`
> - `docs/SARVAM_PRODUCTION_READINESS_SUCCESS_2026_09_17.md`
> - `docs/SARVAM_RENEWAL_AGENT_CONTRACT.md`
> - `apps/web-portal/app/system/voice-integration/AGENTS.md`
> - `apps/web-portal/app/partner/renewals/external/AGENTS.md`
>
> Never add phone numbers, secrets, raw transcripts, or raw webhook payloads to this document.

## Purpose

This record preserves every material success/failure from the first controlled production telephony exercise so a future agent can continue without reconstructing provider behavior from chat history.

## Production prerequisites already verified before this test

- Sarvam Voice Agents scheduling auth for this workspace/campaign uses `X-API-Key`.
- The production readiness probe reaches the configured `cohorts/stream` validation path and receives the expected HTTP 422 validation response for an intentionally invalid empty cohort.
- PR #1978 switched the real single-opportunity dispatch path to `X-API-Key`.
- Production deployment for that change completed successfully.
- External Renewal data remains isolated from verified Customer / Vehicle / Policy masters.
- Bulk calling remains disabled.
- Partner `Call with AI` remains a single-opportunity explicit action.
- The previously exposed webhook secret was rotated before the successful webhook test.

## Controlled campaign

Configured production-controlled campaign:

- Campaign ID: `INSUREIT-Re-e2468e47-50a8`
- Agent: INSUREIT Motor Renewal Assistant
- Agent version: 4
- Retries were kept OFF for the controlled test.
- A legacy manually uploaded bootstrap cohort remained visible in the campaign.
- API-streamed contacts create separate dynamic cohorts.

Important provider behavior learned:

- The cohort display name shown in Sarvam can differ from the `cohort_id` returned by the stream API and stored by INSUREIT.
- Example pattern: the UI may display a name derived from the local INSUREIT attempt UUID such as `renewal-<attempt-prefix>`, while the API response returns a different provider cohort identifier that is persisted in `provider_cohort_id`.
- These are not contradictory identifiers; future diagnostics must distinguish **cohort display name** from **provider cohort ID**.

## Trial 1 — API cohort + live call, webhook missing

### What worked

A Partner user opened a controlled External Renewal opportunity and clicked `Call with AI` exactly once.

INSUREIT created one local voice attempt and Sarvam accepted one streamed cohort user.

Evidence:

- local voice attempt created
- provider campaign binding persisted
- provider cohort ID persisted
- parent submission state became `queued`
- no duplicate attempt was created
- Sarvam campaign UI showed a new one-record cohort created on 2026-09-18
- the campaign was resumed and the user received a live call
- the agent handled the call successfully
- provider analytics/export later showed a successful connected call, approximately 83 seconds, with structured output including an `interested` disposition

### What failed

The campaign webhook URL was not actually present at the time the call completed.

Consequences:

- Sarvam completed the call, but INSUREIT received no webhook.
- The local attempt remained stuck at `queued`.
- No provider attempt event row was created.
- No provider attempt ID, interaction ID, connectivity, completion, duration, disposition, interest, or summary reached INSUREIT automatically.
- Vercel runtime logs showed no request hitting the production Sarvam webhook route during the relevant call window.

### Durable learning

A successful PSTN call is not enough to declare the integration operational.

Before any controlled live call:

1. verify the webhook URL is visibly saved on the exact campaign;
2. verify the rotated webhook secret is active in Production;
3. keep retries OFF;
4. queue only one authorized test opportunity;
5. after completion, require evidence of a webhook event and normalized CRM projection.

Do not infer webhook readiness from environment configuration alone.

## Trial 2 — clean API cohort + live call + webhook success

A second authorized internal test opportunity was used to avoid reusing the stale active attempt from Trial 1.

### Queue / stream result

The Partner user clicked `Call with AI` exactly once.

INSUREIT created a new local attempt and a new API-streamed cohort. The opportunity initially showed the normal queued state.

### Live telephony result

The campaign executed the new streamed contact successfully.

Provider-side evidence:

- connected call
- completion successful
- duration approximately 59 seconds
- structured agent result indicated the customer had already renewed elsewhere
- no follow-up required

### Webhook result

This time the webhook URL was present on the campaign and the callback reached INSUREIT.

Verified production database state:

- parent voice attempt: `completed`
- connectivity: `connected`
- completion: `completed`
- provider attempt ID stored
- provider interaction ID stored
- duration stored
- start/end timestamps stored
- normalized disposition: `already_renewed`
- normalized customer interest: `low`
- follow-up required: false
- customer objection stored
- normalized call summary stored
- one provider attempt event row created
- External Renewal opportunity projected to `renewed_elsewhere`
- Partner UI displayed the closed Renewed Elsewhere state and the AI call summary

This is the first **VERIFIED end-to-end closed loop**:

```text
Partner Call with AI
  -> scoped INSUREIT attempt
  -> Sarvam cohorts/stream
  -> API-created cohort
  -> outbound PSTN call
  -> agent structured outputs
  -> Sarvam campaign webhook
  -> attempt UUID correlation
  -> retry-safe attempt event
  -> normalized voice result
  -> External Renewal CRM interaction/status
  -> Partner UI projection
```

## Trial 1 reconciliation

Because Trial 1 completed before the webhook was configured, its local record remained protected as an active `queued` attempt even though provider analytics proved the call completed.

The provider export contained enough deterministic fields to reconcile safely:

- provider job/attempt identifier
- provider interaction identifier
- exact campaign ID
- exact provider cohort ID
- connected/completed result
- duration and timestamps
- agent disposition/interest
- follow-up flag
- summary

The stale Trial 1 record was reconciled through the existing service-controlled `apply_external_renewal_voice_result(...)` database contract rather than by directly editing tables.

Verified result after reconciliation:

- parent attempt -> `completed`
- connectivity -> `connected`
- completion -> `completed`
- disposition -> `interested`
- interest -> `high`
- follow-up required -> false
- one provider attempt event row exists
- opportunity status -> `interested`

This removes the stale active-attempt guard without weakening idempotency or bypassing the normal projection rules.

## Current production evidence state

As of 2026-09-18:

- Sarvam auth using `X-API-Key`: **VERIFIED**
- CRM stream cohort creation: **VERIFIED**
- single-opportunity Partner dispatch: **VERIFIED**
- live outbound PSTN call: **VERIFIED**
- agent v4 conversation behavior in controlled tests: **VERIFIED**
- structured output variables: **VERIFIED**
- campaign webhook delivery: **VERIFIED**
- webhook secret/campaign binding: **VERIFIED in the successful controlled test**
- provider attempt idempotency event creation: **VERIFIED**
- normalized CRM projection: **VERIFIED**
- Partner UI projection: **VERIFIED**
- External Renewal isolation from verified masters: **PRESERVED**
- bulk calling: **NOT ENABLED**
- autonomous campaign lifecycle from INSUREIT: **NOT IMPLEMENTED**
- production-scale calling policy/DND/monitoring/automatic reconciliation: **NOT YET APPROVED/IMPLEMENTED**

## Required operating rule for future trials

Every material Voice Agent trial — successful or failed — must be recorded in repository Markdown before the trial is treated as closed.

Record only durable operational evidence:

- date and trial purpose
- exact component/path being tested
- what changed
- what succeeded
- what failed
- verified root cause when known
- cleanup/reconciliation performed
- exact evidence state
- next safe step

Do not record:

- phone numbers
- secrets/tokens
- raw transcripts
- full raw webhook bodies
- unnecessary customer identity
- speculative conclusions

Also update the main voice handoff whenever the current production state or next production plan materially changes.

## Next production implementation plan

The single-opportunity closed loop is now proven, but this does **not** authorize bulk calling.

Recommended next phases:

### Phase A — operational hardening

- add explicit webhook-health / last-callback visibility to the IT Super User readiness surface
- add reconciliation visibility for attempts stuck in active states beyond an approved age
- add a safe provider-result reconciliation workflow using provider IDs/exports or provider API evidence; never correlate by phone number
- preserve idempotency and one-active-attempt rules
- add regression coverage for missing-webhook recovery
- define production calling hours, retry policy, DND/opt-out handling and escalation rules

### Phase B — campaign lifecycle automation

- make INSUREIT the campaign control plane
- programmatically create/reuse the approved Sarvam campaign/deployment
- stream selected opportunities directly from CRM
- avoid normal dependence on CSV uploads or manual cohort creation
- expose only business controls to Partner users; provider administration remains IT Super User only
- preserve explicit single-opportunity mode until monitored production confidence is established

### Phase C — controlled batch calling

Only after Phase A/B evidence is green:

- small opt-in batch selection
- server-side eligibility recheck per opportunity
- hard maximum batch size
- clear calling window
- DNC/terminal-state suppression
- dedupe and active-attempt suppression
- pause/kill-switch control
- result monitoring and reconciliation dashboard
- staged expansion based on observed failure rate and webhook integrity

### Phase D — production intelligence

After the campaign lifecycle is stable:

- follow-up worklists
- quote/request routing
- human-assistance escalation
- measured conversation-quality improvements
- optional enrichment only through approved controlled providers
- no automatic Policy Intake creation until separately approved

## Stop conditions

Immediately stop/resuspend calling if any of these occur:

- webhook callbacks disappear
- campaign binding mismatch
- duplicate attempt creation
- provider result cannot be correlated by local attempt UUID
- DNC/opt-out is not honored
- retry behavior differs from approved policy
- verified Customer/Vehicle/Policy data is touched by the external-renewal voice path
- an attempt becomes ambiguous and cannot be safely reconciled

