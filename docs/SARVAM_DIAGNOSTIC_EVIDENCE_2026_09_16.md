# Sarvam production diagnostic evidence — 2026-09-16

This evidence supplements `docs/SARVAM_VOICE_WORKFLOW_CURRENT_STATE_2026_09_15.md` and must be read together with it.

## Repeated production result

While campaign `INSUREIT Renewal Controlled 2` remained PAUSED, the IT Super User ran the read-only Sarvam deep diagnostics repeatedly.

Across the original X-API-Key run plus two immediate repeat runs, the result pattern remained stable:

- Core `api.sarvam.ai` probe using `api-subscription-key`: HTTP 403 with `invalid_api_key_error`.
- Voice Agents scheduling using `api-subscription-key`: HTTP 401.
- Voice Agents scheduling using Bearer: HTTP 401.
- Voice Agents scheduling using `X-API-Key`: HTTP 500 on every run.

Each X-API-Key 500 response had a different provider request ID, proving these were fresh provider requests rather than a cached browser result.

## Interpretation

The documented campaign webhook-list endpoint is still present in current Sarvam documentation:

`GET https://apps.sarvam.ai/api/scheduling/v1/orgs/:org_id/workspaces/:workspace_id/campaigns/:campaign_id/webhooks`

Sarvam's current error guidance classifies HTTP 500 as an internal server-side failure and recommends retry/backoff for 500/503. The repeated X-API-Key 500 therefore isolates the current blocker to provider-side processing of the Voice Agents scheduling request, or to a provider-side defect in how this credential/resource combination is handled. It does not prove that authorization fully succeeded, so INSUREIT must not switch real dispatch to X-API-Key yet.

The stable comparison is important:

- subscription-key / Bearer are rejected immediately with 401 by `apps.sarvam.ai`;
- X-API-Key reaches a different code path and consistently fails with 500;
- the general `api.sarvam.ai` product rejects the Voice Agents credential with 403 `invalid_api_key_error`.

## Current safe state

- Campaign remains PAUSED.
- No controlled opportunities should be queued yet.
- Do not rotate credentials again without new evidence.
- Do not change campaign, workspace, org, agent ID or agent version based solely on the 500.
- Do not switch production cohort submission to X-API-Key until a read-only Voice Agents request returns a resource-level response (2xx, 404, or a provider-documented authorization response) instead of 500.

## Campaign lookup isolation probe

The next deterministic check has now been implemented in the diagnostics branch. It adds a fifth read-only probe using the exact same:

- `X-API-Key` credential;
- organization ID;
- workspace ID;
- HTTP method (`GET`);
- campaign webhook-list endpoint family;

but substitutes a fixed, synthetic, intentionally nonexistent campaign ID.

No customer data, call submission, cohort streaming, campaign update, resume, retry, or other provider mutation is performed.

Interpretation after production deployment:

- configured campaign=500 and intentionally missing campaign=404: authentication and ordinary campaign lookup are working; the real configured campaign or a backend path reached after finding it is specifically failing;
- configured campaign=500 and intentionally missing campaign=500: Sarvam fails before normal campaign existence resolution, strongly isolating the blocker to the Voice Agents scheduling authentication/gateway/workspace layer rather than this specific campaign;
- both X-API-Key probes=401/403: the credential is rejected before campaign lookup;
- configured campaign=2xx: the read-only scheduling blocker is cleared for that resource.

Until this comparison is run in production, the repeated 500 remains unresolved provider-side evidence rather than proof of successful authentication.

## Provider escalation evidence

If Sarvam support is contacted, include the exact endpoint family, approximate timestamp, and the provider request IDs shown by the diagnostics UI. Do not include the API key itself. The repeated 500 request IDs should be supplied because Sarvam can trace them server-side.
