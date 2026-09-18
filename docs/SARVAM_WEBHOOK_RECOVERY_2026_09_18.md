# Sarvam Webhook Re-delivery Recovery — 2026-09-18

> Operational recovery slice after the first verified end-to-end production voice test.
>
> Read with:
> - `docs/SARVAM_CONTROLLED_LIVE_TEST_2026_09_18.md`
> - `docs/SARVAM_OPERATIONAL_HARDENING_2026_09_18.md`
> - `docs/VOICE_AGENT_RENEWAL_INTEGRATION_HANDOFF.md`
>
> Never store phone numbers, secrets, raw transcripts, or raw webhook payloads here.

## Why this exists

The first controlled live call proved a critical failure mode: Sarvam can complete the phone call successfully while INSUREIT remains at `queued` if the campaign webhook is missing or delivery fails.

Manual database reconciliation works, but it should remain an exceptional fallback. The preferred recovery path is to ask Sarvam to re-deliver the original webhook so the normal INSUREIT webhook validation, idempotency, normalization and CRM projection run unchanged.

Sarvam's current Voice Agents documentation exposes a campaign webhook re-delivery endpoint:

`POST /api/scheduling/v1/orgs/:org_id/workspaces/:workspace_id/campaigns/:campaign_id/webhooks/retry`

with `attempt_ids` and an asynchronous HTTP 202 acceptance response.

## Implemented recovery contract

Branch: `feat/sarvam-webhook-retry-recovery`

IT Super User Voice Integration gains a **Webhook recovery** form.

Input:

- Sarvam provider attempt ID only.

Server-side behavior:

1. exact `it_super_user` role is required;
2. `manage_system` at `approve` is required;
3. provider attempt ID must be UUID-shaped;
4. campaign/org/workspace/API key come only from server environment;
5. the server calls the configured campaign `/webhooks/retry` endpoint with `X-API-Key`;
6. exactly one provider attempt ID is submitted per action;
7. only HTTP 202 is treated as accepted;
8. no customer phone number is accepted or used;
9. no cohort is created and no phone call is placed;
10. the original Sarvam webhook, when redelivered, is processed by the existing idempotent INSUREIT webhook path.

## Why this is safer than manual CRM mutation

The admin supplies only the provider attempt ID. INSUREIT does not trust admin-entered disposition, interest, customer summary, phone number, campaign result or CRM outcome.

The provider re-sends its original signed-by-contract payload to the configured INSUREIT webhook URL. INSUREIT then rechecks:

- webhook secret;
- expected campaign;
- optional expected app/agent binding;
- UUID-shaped local `user_identifier`;
- known status/output values;
- provider attempt idempotency;
- the existing result-projection RPC.

If the same provider attempt was already applied, the unique provider event key makes the re-delivery idempotent.

## Safety boundaries

This recovery action does **not**:

- place or retry a phone call;
- resume a campaign;
- create a cohort;
- change retry/calling-window policy;
- correlate by phone number;
- accept a browser-supplied local Partner ID or opportunity ID;
- persist a transcript or raw payload;
- update verified Customer / Vehicle / Policy masters;
- bypass the normal webhook result projection.

## Known provider caveat

Earlier diagnostics found the Sarvam **list webhook deliveries** GET path returned HTTP 500 for valid campaigns while nonexistent campaigns returned 404. That defect does not prove the documented **retry webhook deliveries** POST path is broken.

Therefore this slice implements re-delivery against a known provider attempt ID from provider evidence. It does not depend on the list endpoint being healthy.

## Evidence state

- recovery model: **IMPLEMENTED**
- IT Super User route: **IMPLEMENTED**
- Voice Integration recovery UI: **IMPLEMENTED**
- regression guards: **IMPLEMENTED**
- schema change: **NONE**
- call placement: **NONE**
- provider re-delivery live test: **NOT YET RUN**
- canonical CI: **PENDING**
- merge/deployment: **PENDING**

## First safe verification after deployment

Use a completed controlled internal provider attempt whose result is already idempotently present in INSUREIT.

1. enter its provider attempt ID in Webhook recovery;
2. require Sarvam HTTP 202 acceptance;
3. wait for webhook delivery;
4. verify no new phone call occurred;
5. verify no duplicate CRM interaction/outcome was created;
6. verify the existing provider attempt event remains single/idempotent;
7. record success/failure in this document and the main voice handoff.

Only after an idempotent completed-attempt retry is proven should this be used to recover a genuinely stale production attempt.
