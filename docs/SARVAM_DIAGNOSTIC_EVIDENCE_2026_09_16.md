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
- Do not rotate API credentials again without new evidence.
- Do not change campaign, workspace, org, agent ID or agent version based solely on the 500.
- Do not switch production cohort submission to X-API-Key until a read-only Voice Agents request returns a resource-level response (2xx, 404, or a provider-documented authorization response) instead of 500 for the real campaign.

## Campaign lookup isolation probe

The deterministic comparison added a fifth read-only probe using the exact same:

- `X-API-Key` credential;
- organization ID;
- workspace ID;
- HTTP method (`GET`);
- campaign webhook-list endpoint family;

but substituted a fixed, synthetic, intentionally nonexistent campaign ID.

No customer data, call submission, cohort streaming, campaign update, resume, retry, or other provider mutation was performed.

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

1. `X-API-Key` is accepted far enough for the Voice Agents scheduling service to route the request using the configured org/workspace and perform campaign existence lookup.
2. A nonexistent campaign produces the expected resource-level HTTP 404 response.
3. Therefore the HTTP 500 is **specific to the configured real campaign or to backend processing reached only after that campaign is found**. It is not a generic browser cache issue, not a generic X-API-Key rejection, and not a generic failure to resolve the org/workspace route.
4. `api-subscription-key` and Bearer remain incorrect for this Voice Agents scheduling API path because both still stop at HTTP 401.
5. The general `api.sarvam.ai` 403 should be treated separately from the Voice Agents scheduling credential path; it does not invalidate the successful X-API-Key campaign lookup evidence.

## Campaign Advanced/Webhook inspection result

The user opened the paused campaign's Edit flow and inspected Schedule -> Advanced.

Observed:

- a Webhook URL was already configured for the campaign;
- therefore the earlier hypothesis that the 500 was caused simply by a blank/missing campaign webhook was ruled out;
- the configured URL pointed at the INSUREIT production campaign webhook route and used a query-string token mechanism;
- the screenshot visibly exposed the current webhook token value. Treat that token as compromised and rotate it before any live webhook processing. Do not preserve or repeat the exposed token value in repository documentation, chat replies, issue bodies, or support tickets.

### Revised hypotheses before the removal test

The remaining campaign-specific causes included:

1. Sarvam had invalid/legacy/internal state attached to this campaign's `app_config.webhook_config` even though the UI rendered a URL;
2. the campaign record had stale state from the August 2026 outbound-webhook rollout and the webhook-list backend crashed while materializing delivery/configuration state;
3. the query-string token URL format was accepted by the UI but triggered a provider-side parsing/deserialization defect for this campaign; or
4. another campaign-specific backend attribute was inconsistent and the webhook-list endpoint was only the first read path exposing that defect.

## Webhook-removal retest result

The user then removed the campaign Webhook URL while the campaign remained PAUSED, saved the campaign, and reran the production deep diagnostics.

The result did **not** change:

- configured real campaign with `X-API-Key`: HTTP **500**;
- intentionally nonexistent campaign with the same `X-API-Key`, org and workspace: HTTP **404**;
- scheduling with `api-subscription-key`: HTTP **401**;
- scheduling with Bearer: HTTP **401**;
- core `api.sarvam.ai`: HTTP **403** with `invalid_api_key_error`.

### What the webhook-removal test rules out

This rules out the current Webhook URL string itself as the direct cause of the 500. The provider failure survives removal and save, so the strongest remaining explanation is **campaign-specific backend state** attached to the real campaign record or another backend path reached after that campaign is found.

The webhook-list endpoint is documented as returning delivery records for a campaign. A healthy campaign with no deliveries should return a resource-level response such as HTTP 200 with an empty list, not a 500. The synthetic missing campaign already returns the expected 404, which is the control proving ordinary lookup is functioning.

## Next deterministic check

Keep the original campaign PAUSED and do not add contacts.

Create a brand-new control campaign in the same confirmed Sarvam workspace with:

- the same agent/app and version used by the controlled campaign;
- the same telephony connection;
- no customer cohort / no contacts;
- retry OFF;
- no Webhook URL initially;
- a future schedule or PAUSED state so it cannot dial.

Before adding a webhook or any contacts, run the same read-only `GET /campaigns/:campaign_id/webhooks?limit=1` probe against the new control campaign using `X-API-Key`.

Interpretation:

- **new control campaign = 2xx, original = 500**: strongly proves stale/corrupt/legacy backend state in the original campaign. Use the new clean campaign as the replacement controlled execution campaign after re-binding INSUREIT and re-verifying the webhook.
- **new control campaign = 500, original = 500**: the issue is broader than one campaign record and should be escalated to Sarvam as a provider backend defect for existing campaign resources in this workspace.
- **new control campaign = 401/403**: the control campaign is not being reached under the same authorization context and the credential/resource contract must be revisited.

Do not change the production `SARVAM_RENEWAL_CAMPAIGN_ID` merely to perform this diagnostic. Use a separate read-only diagnostic control campaign ID so the current production binding remains intact until the clean campaign is proven healthy.

Do not resume either campaign until the provider read path is healthy and the webhook secret has been rotated.

## Provider escalation evidence

If Sarvam support is contacted, include the exact endpoint family, approximate timestamp, and the provider request IDs shown by the diagnostics UI. Do not include the API key or webhook secret. The repeated 500 request IDs should be supplied because Sarvam can trace them server-side.
