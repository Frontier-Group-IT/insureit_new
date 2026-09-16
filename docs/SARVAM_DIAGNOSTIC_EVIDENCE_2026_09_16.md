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

## Production campaign-isolation result

After PR #1903 was merged and deployed to production, the user reran deep diagnostics while the campaign remained PAUSED.

Observed X-API-Key comparison:

- configured campaign `INSUREIT Renewal Controlled 2`: HTTP **500**;
- intentionally nonexistent campaign in the same org/workspace: HTTP **404**, classification `campaign_binding_not_found`.

The other controls remained unchanged:

- core `api.sarvam.ai`: HTTP 403 with `invalid_api_key_error`;
- scheduling with `api-subscription-key`: HTTP 401;
- scheduling with Bearer: HTTP 401.

### What this proves

This is stronger evidence than the earlier repeated 500s:

1. `X-API-Key` is accepted far enough for the Voice Agents scheduling service to route the request using the configured org/workspace and perform campaign existence lookup.
2. A nonexistent campaign produces the expected resource-level HTTP 404 response.
3. Therefore the HTTP 500 is **specific to the configured real campaign or to backend processing reached only after that campaign is found**. It is not a generic browser cache issue, not a generic X-API-Key rejection, and not a generic failure to resolve the org/workspace route.
4. `api-subscription-key` and Bearer remain incorrect for this Voice Agents scheduling API path because both still stop at HTTP 401.
5. The general `api.sarvam.ai` 403 should be treated separately from the Voice Agents scheduling credential path; it does not invalidate the successful X-API-Key campaign lookup evidence.

### Strongest current hypothesis

Sarvam added outbound campaign webhooks on 2026-08-20. Current Sarvam documentation says campaign completion webhooks are configured in the campaign's `app_config.webhook_config`, and the `/campaigns/:campaign_id/webhooks` endpoint lists delivery records for that configured campaign.

The controlled campaign's INSUREIT webhook was not yet independently verified/configured in Sarvam. Therefore a plausible campaign-specific cause of the 500 is that the real campaign has missing, incomplete, legacy, or otherwise invalid outbound `webhook_config` state and Sarvam's webhook-list backend is failing instead of returning an empty list. This remains a hypothesis until the campaign's Advanced/Webhook configuration is inspected or corrected.

### Next safe diagnostic action

Keep the campaign PAUSED. In the Sarvam campaign editor, inspect the campaign's Advanced/Webhook configuration without resuming or adding contacts. Confirm whether a webhook URL is configured. If absent, configure the already-approved INSUREIT campaign webhook endpoint using the existing server-side secret mechanism, save while paused, and rerun the read-only deep diagnostics before any cohort submission. Do not expose the webhook secret in screenshots or repository documentation.

If the campaign already has the correct webhook URL and the real-campaign X-API-Key probe still returns 500 while the synthetic campaign returns 404, escalate to Sarvam with the provider request IDs from the 500 responses because the remaining evidence points to campaign-specific provider backend state.

## Provider escalation evidence

If Sarvam support is contacted, include the exact endpoint family, approximate timestamp, and the provider request IDs shown by the diagnostics UI. Do not include the API key itself. The repeated 500 request IDs should be supplied because Sarvam can trace them server-side.
