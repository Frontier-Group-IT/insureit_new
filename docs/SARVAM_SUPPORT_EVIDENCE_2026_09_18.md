# Sarvam Voice Agents Support Evidence — 2026-09-18

> Provider-support evidence package for the campaign webhook-list / webhook-retry behavior observed during INSUREIT controlled production validation.
>
> This document intentionally excludes phone numbers, customer identity, secrets, raw webhook payloads, and transcripts.

## Workspace / campaign context

- INSUREIT production integration uses Sarvam Voice Agents scheduling APIs.
- Configured controlled campaign ID: `INSUREIT-Re-e2468e47-50a8`
- Agent: INSUREIT Motor Renewal Assistant
- Agent version: 4
- Scheduling authentication proven in production with `X-API-Key`.
- Normal `cohorts/stream` path is working.
- Normal outbound telephony is working.
- Normal campaign webhook delivery has succeeded in production when the campaign webhook URL is configured.

## Proven normal end-to-end behavior

A controlled call on 2026-09-18 successfully completed this full lifecycle:

```text
INSUREIT single-opportunity dispatch
  -> Sarvam cohorts/stream
  -> API-created cohort
  -> outbound PSTN call
  -> structured Voice Agent output
  -> Sarvam campaign webhook
  -> INSUREIT idempotent provider event
  -> normalized External Renewal CRM projection
  -> Partner UI update
```

This proves the webhook URL, rotated INSUREIT webhook secret, campaign binding, agent/app binding, callback route, and normal CRM projection can work together.

## Issue A — webhook delivery listing endpoint

Production read-only diagnostics against:

`GET /api/scheduling/v1/orgs/:org_id/workspaces/:workspace_id/campaigns/:campaign_id/webhooks?limit=1`

showed:

- valid configured campaign + `X-API-Key` -> provider HTTP **500**
- fresh newly created valid control campaign + `X-API-Key` -> provider HTTP **500**
- intentionally nonexistent campaign + same org/workspace/auth/path -> provider HTTP **404**

Interpretation:

- authentication and org/workspace routing are reaching campaign lookup;
- missing campaigns behave normally;
- valid campaigns fail later in Sarvam's webhook-delivery-list processing;
- the defect is not isolated to one legacy campaign.

## Issue B — webhook retry accepted but callback not observed

INSUREIT uses the documented retry route:

`POST /api/scheduling/v1/orgs/:org_id/workspaces/:workspace_id/campaigns/:campaign_id/webhooks/retry`

with exactly one previously completed provider attempt ID.

Observed on 2026-09-18:

- INSUREIT used the exact stored Sarvam `provider_attempt_id`;
- request authenticated with `X-API-Key`;
- Sarvam returned HTTP **202**;
- INSUREIT UI recorded the retry as accepted/queued;
- no new phone call was placed;
- no callback request reached the production INSUREIT webhook route after waiting more than 25 minutes;
- provider-event count remained unchanged, so no duplicate CRM outcome was created.

Important: INSUREIT treats HTTP 202 only as **queued for asynchronous processing**, not as proof of webhook delivery.

## Failed trial that must not be confused with Issue B

The first manual recovery attempt used a 64-character value copied from Sarvam's **Phone (hashed)** UI field rather than the UUID-shaped provider attempt ID.

INSUREIT rejected that value locally before contacting Sarvam.

That failed local-validation trial is not evidence of a provider API failure.

The UI has since been corrected to use the authoritative stored `provider_attempt_id` automatically.

## What INSUREIT needs Sarvam to investigate

Please confirm:

1. why the webhook-delivery list endpoint returns HTTP 500 for valid campaigns while returning 404 normally for a missing campaign;
2. whether a webhook retry that returns HTTP 202 should always create a delivery record visible in the list endpoint;
3. the expected processing delay for a retry accepted with 202;
4. whether webhook retry works for attempts originating from API-streamed cohorts;
5. whether webhook retry requires any additional campaign/webhook state beyond a webhook URL that already works for normal live callbacks;
6. whether Sarvam can inspect the provider-side retry execution for the relevant controlled attempt using the campaign ID and timestamp supplied separately through the support channel.

## Support-safe evidence available on request

INSUREIT operators can provide through the private support channel:

- exact organization ID;
- exact workspace ID;
- exact provider attempt ID;
- exact provider interaction ID;
- provider request IDs from the diagnostic calls;
- retry timestamp;
- screenshots showing HTTP 202 acceptance;
- screenshots/exports showing the original call completed normally.

Do not place these private identifiers into a public issue or repository discussion unless required.

## Current INSUREIT operational position

- normal live calling: **VERIFIED**
- normal webhook callback: **VERIFIED**
- idempotent CRM projection: **VERIFIED**
- webhook retry request acceptance (HTTP 202): **VERIFIED**
- webhook retry callback delivery: **NOT OBSERVED**
- webhook delivery listing for valid campaigns: **PROVIDER HTTP 500**
- bulk/autonomous calling: **NOT ENABLED**

No further phone calls are required to investigate these two provider-side webhook behaviors.
