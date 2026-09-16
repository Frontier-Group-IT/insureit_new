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

Do not replace production `SARVAM_RENEWAL_CAMPAIGN_ID` with this ID yet. The fresh campaign is a diagnostic control only until its read-only provider behavior is known.

## New read-only probe

The portal has a dedicated IT-Super-User-only diagnostic route for this fresh campaign:

`/system/voice-integration/control-campaign-diagnostic`

It performs exactly one provider request:

`GET https://apps.sarvam.ai/api/scheduling/v1/orgs/:org_id/workspaces/:workspace_id/campaigns/INSUREIT-Re-31885c09-3493/webhooks?limit=1`

Authentication header:

`X-API-Key: <server-side SARVAM_API_KEY>`

Safety boundaries:

- no cohort streaming;
- no campaign resume/start/update;
- no call placement;
- no contact mutation;
- no provider POST/PUT/PATCH/DELETE;
- no API key, webhook secret, raw response body, phone number or transcript rendered/logged;
- only sanitized HTTP status, classification, provider error code and provider request/correlation ID may be shown.

## Interpretation

- fresh campaign HTTP 2xx while original remains 500: strong evidence the original campaign has corrupt, stale or legacy provider-side state. The controlled workflow can then be migrated to the clean campaign after webhook-secret rotation and a deliberate binding change.
- fresh campaign HTTP 500: the failure is broader than the original campaign and likely tied to Sarvam's campaign backend path for valid campaigns in this workspace/product.
- fresh campaign HTTP 404: the new campaign is not yet visible in the configured org/workspace binding or the campaign ID is wrong/stale.
- fresh campaign HTTP 401/403: the request is rejected before normal campaign-resource processing and the X-API-Key authorization assumption must be revisited.

## Current safety state

Keep both the original and fresh control campaign PAUSED. Do not use either for broader customer calling. The previously exposed webhook token must be rotated before any live webhook processing resumes.
