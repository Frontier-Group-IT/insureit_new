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

## Next deterministic check

If further client-side isolation is needed before provider escalation, compare the same read-only X-API-Key request against:

1. the configured real campaign ID; and
2. an intentionally nonexistent campaign ID in the same confirmed org/workspace.

Interpretation:

- real=500 and nonexistent=404: authentication/resource lookup works and the real campaign/provider state is specifically failing;
- real=500 and nonexistent=500: provider fails before campaign resource resolution, strongly supporting a scheduling auth/gateway/backend defect;
- nonexistent=401/403: X-API-Key is not generally accepted and the real 500 is an inconsistent provider error path.

This comparison must remain GET-only and must never create, update, retry, stream, resume, or otherwise mutate a Sarvam campaign.

## Provider escalation evidence

If Sarvam support is contacted, include the exact endpoint family, approximate timestamp, and the provider request IDs shown by the diagnostics UI. Do not include the API key itself. The repeated 500 request IDs should be supplied because Sarvam can trace them server-side.
