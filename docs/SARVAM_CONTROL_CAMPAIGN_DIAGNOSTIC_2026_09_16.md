# Sarvam fresh control campaign diagnostic — 2026-09-16

Read this together with:

- `docs/SARVAM_VOICE_WORKFLOW_CURRENT_STATE_2026_09_15.md`
- `docs/SARVAM_DIAGNOSTIC_EVIDENCE_2026_09_16.md`
- `docs/VOICE_AGENT_RENEWAL_INTEGRATION_HANDOFF.md`

## Why this control campaign exists

The original controlled campaign `INSUREIT Renewal Controlled 2` consistently returns HTTP 500 from the read-only Voice Agents webhook-list endpoint when authenticated with `X-API-Key`, while a synthetic nonexistent campaign in the same org/workspace returns HTTP 404. Removing and saving the original campaign's Webhook URL did not change the 500. This isolates the blocker to campaign-specific or broader Sarvam backend state rather than generic campaign lookup or the webhook URL string itself.

## Fresh control campaign

A new campaign was created only to compare Sarvam provider behavior against the original campaign:

- campaign name: `INSUREIT Renewal Controlled 3`
- campaign ID: `INSUREIT-Re-31885c09-3493`
- agent: `INSUREIT Motor Renewal Assistant`
- agent version: v4
- telephony: same Sarvam Managed / Vobiz connection family as the controlled workflow
- retries: OFF
- phone number rotation: OFF
- cohort: only user-authorized internal test recipients; do not store their phone numbers in repository documentation
- webhook: intentionally blank for the initial provider comparison
- the campaign must remain PAUSED while this diagnostic is run

Do not replace production `SARVAM_RENEWAL_CAMPAIGN_ID` with this ID yet. The fresh campaign is a diagnostic control only until its provider behavior is known.

## First fresh-campaign production result

After PR #1953 was merged and deployed, the IT Super User ran the fresh campaign control probe against `INSUREIT-Re-31885c09-3493`.

Observed result:

- `GET .../campaigns/INSUREIT-Re-31885c09-3493/webhooks?limit=1`
- authentication: `X-API-Key`
- HTTP **500**
- classification: `provider_http_500`
- provider request ID was returned and is available from the diagnostic UI for support escalation.

This is decisive against the earlier "original campaign corruption only" theory. The newly-created paused campaign, with webhook intentionally blank and no legacy configuration history, fails on the same webhook-delivery listing endpoint as the original campaign.

Combined with the established synthetic missing-campaign result of HTTP 404, the evidence now means:

1. `X-API-Key` is accepted far enough to route through the configured org/workspace and perform campaign existence lookup.
2. A nonexistent campaign returns normal resource-level HTTP 404.
3. Two different valid campaigns both return HTTP 500 only after Sarvam finds the campaign.
4. Therefore the failure is broader than either campaign and is most likely inside Sarvam's webhook-delivery listing backend path for valid campaign resources in this workspace/product.
5. This does **not** yet prove that the CRM cohort-stream endpoint is broken. The webhook-list endpoint and stream-cohort endpoint are separate backend operations.

Current Sarvam documentation still describes the campaign webhook-list endpoint as a normal GET that should return HTTP 200 with an `items` list and pagination metadata, including when `limit` is supplied. `limit=1` is explicitly documented as valid because the accepted range is 1-250. Therefore the repeated HTTP 500 is not explained by the query parameter itself.

## Next deterministic diagnostic

The next probe targets the exact API path INSUREIT ultimately needs for CRM-driven calling without creating a contact or queueing a call.

Endpoint:

`POST https://apps.sarvam.ai/api/scheduling/v1/orgs/:org_id/workspaces/:workspace_id/campaigns/INSUREIT-Re-31885c09-3493/cohorts/stream`

Authentication:

`X-API-Key: <server-side SARVAM_API_KEY>`

Payload is intentionally invalid and contains **no phone number**:

- empty cohort name;
- empty `users` array.

Sarvam's published schema requires a 1-50 character name and 1-1000 users, and documents HTTP 422 for validation errors. Therefore:

- HTTP 400/422 proves authentication, workspace routing, campaign lookup and the stream-cohort endpoint are reachable, while creating no callable contact;
- HTTP 500 means the scheduling failure is broader than webhook-listing and affects the campaign stream path too;
- HTTP 401/403 reopens authorization as the blocker;
- HTTP 404 means campaign visibility differs between the read and stream paths;
- an unexpected 2xx would indicate Sarvam accepted an invalid empty cohort and must not be treated as a successful safety result.

## Safety boundaries for the validation-only stream probe

- campaign remains PAUSED;
- payload contains no phone number or customer identity;
- no valid user record is submitted;
- no call can be placed from this probe;
- no campaign resume/start/update;
- no API key, webhook secret, raw provider response body, phone number or transcript rendered/logged;
- only sanitized HTTP status, classification, provider error code and provider request/correlation ID may be shown.

## Current safety state

Keep both the original and fresh control campaign PAUSED. Do not use either for broader customer calling. The previously exposed webhook token must be rotated before any live webhook processing resumes.
