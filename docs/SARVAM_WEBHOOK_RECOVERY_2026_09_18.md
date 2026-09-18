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


## Live verification attempt 1 — FAILED BEFORE PROVIDER CALL

Date: 2026-09-18

The first production use of the recovery form returned `webhook_retry=failed` without an HTTP provider status.

Verified evidence:

- the submitted value was a 64-character hexadecimal Sarvam value copied from the campaign UI;
- production INSUREIT stores the real Sarvam `provider_attempt_id` as a UUID-shaped identifier;
- Vercel logs show the authenticated retry route executed and redirected, but no provider status was returned;
- therefore the request failed local provider-attempt-ID validation before INSUREIT contacted Sarvam;
- no phone call was placed;
- no webhook retry was sent to Sarvam;
- no CRM/provider-event data changed.

Root cause:

The Sarvam campaign UI also displays a **Phone (hashed)** identifier. That value can look like a provider identifier, but it is not the `attempt_id` required by the webhook retry API.

Durable correction:

- do not ask IT users to manually copy a provider attempt ID from mixed provider UI identifiers;
- Voice Integration must use the already persisted `external_renewal_voice_attempts.provider_attempt_id` as the authoritative retry identifier;
- completed attempts should expose a server-rendered **Retry webhook** action that posts the exact stored provider attempt ID;
- phone numbers, phone hashes, interaction IDs and cohort IDs must not be accepted as substitutes.

The failed trial is preserved because it identified a real operational UX ambiguity; it is not evidence that Sarvam's `/webhooks/retry` endpoint failed.


## Live verification attempt 2 — PROVIDER ACCEPTED, CALLBACK NOT YET OBSERVED

Date: 2026-09-18

After deploying the stored-provider-attempt-ID recovery UX, IT Super User retried one completed controlled attempt using the per-row **Retry webhook** action.

Verified evidence:

- the browser showed `webhook_retry=accepted`;
- provider status returned to INSUREIT was HTTP **202**;
- therefore Sarvam accepted the webhook re-delivery request asynchronously;
- no new phone call was initiated by this recovery action;
- Vercel logs show the authenticated INSUREIT retry route executed on the current production deployment;
- after waiting and rechecking, no request had yet reached `/api/integrations/sarvam/voice-campaign-webhook`;
- `external_renewal_voice_attempt_events` remained at 2 rows, so no duplicate event was created.

Current interpretation:

The retry request contract itself is now proven through provider acceptance. The asynchronous re-delivery has **not yet been observed**, so the workflow must not be marked fully verified.

Next safe step:

1. allow additional time for Sarvam's asynchronous delivery;
2. recheck Vercel webhook-route logs and `external_renewal_voice_attempt_events`;
3. if delivery eventually arrives, verify the event count remains unchanged because the provider attempt ID is idempotent;
4. if no callback arrives after a reasonable provider delay, treat that as a provider webhook re-delivery issue and investigate with the known attempt ID / provider support evidence rather than retrying calls or mutating CRM state manually.

Evidence state: **RETRY REQUEST ACCEPTED / CALLBACK PENDING**.


### Follow-up observation — callback still absent after provider delay

A later production recheck approximately 25+ minutes after the HTTP 202 acceptance still showed:

- no request to the INSUREIT campaign webhook route;
- provider event count unchanged at 2;
- latest provider event timestamp unchanged;
- both controlled attempts remained completed with no duplicate CRM projection.

Sarvam's current documentation states that HTTP 202 means the retry request is **queued for asynchronous processing**; it does not guarantee that the webhook has already been delivered. Therefore the accepted retry must remain classified as **provider accepted / delivery not observed**.

This strengthens the provider-side investigation requirement. Do not convert HTTP 202 into a successful recovery state unless the callback is actually observed.

If a future retry is needed for proof, prefer a completed attempt known to have had a successful original webhook delivery. If that also remains undelivered after HTTP 202, collect the provider attempt ID and timestamp for Sarvam support rather than repeatedly retrying or altering CRM state.


## UI semantics correction after HTTP 202 trial

The provider retry endpoint returns HTTP 202 immediately and processes delivery asynchronously. Production evidence showed that 202 can be followed by no observed callback for an extended period.

Therefore the Voice Integration UI must never present 202 as completed webhook recovery. The correct user-facing state is:

**Webhook retry queued by Sarvam — delivery unverified until INSUREIT observes the callback.**

This distinction is now implemented on branch `fix/sarvam-webhook-retry-pending-state`.

Provider documentation also confirms campaign webhook delivery records are listable as `running`, `completed`, or `failed`, and that retry requests are asynchronous. INSUREIT's earlier campaign webhook-list probe currently receives provider HTTP 500 for valid campaigns, so callback arrival in INSUREIT remains the authoritative operational evidence until Sarvam fixes that listing defect.
