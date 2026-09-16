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

The next deterministic check added a fifth read-only probe using the exact same:

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

- a Webhook URL is already configured for the campaign;
- therefore the earlier hypothesis that the 500 was caused simply by a blank/missing campaign webhook is ruled out;
- the configured URL points at the INSUREIT production campaign webhook route and uses a query-string token mechanism;
- the screenshot visibly exposed the current webhook token value. Treat that token as compromised and rotate it before any live webhook processing. Do not preserve or repeat the exposed token value in repository documentation, chat replies, issue bodies, or support tickets.

### Revised strongest hypotheses

The remaining campaign-specific causes include:

1. Sarvam has invalid/legacy/internal state attached to this campaign's `app_config.webhook_config` even though the UI renders a URL;
2. the campaign record has stale state from the August 2026 outbound-webhook rollout and the webhook-list backend crashes while materializing delivery/configuration state;
3. the query-string token URL format itself is accepted by the UI but triggers a provider-side parsing/deserialization defect for this campaign; or
4. another campaign-specific backend attribute is inconsistent and the webhook-list endpoint is only the first read path exposing that defect.

The evidence does **not** currently justify changing the API key, org ID, workspace ID, campaign ID, agent ID or agent version.

## Webhook-removal retest

The Webhook URL was then removed from the paused campaign and the campaign was saved. The user reran Deep Diagnostics. The diagnostic pattern remained unchanged: real configured campaign + `X-API-Key` continued returning HTTP 500 while the intentionally missing campaign continued returning HTTP 404; legacy subscription-key/Bearer remained 401 and core API remained 403 `invalid_api_key_error`.

This rules out the webhook URL string itself as the direct cause. The blocker is broader campaign-specific Sarvam backend state.

## Fresh-control-campaign limitation discovered

The Sarvam campaign creation UI requires an uploaded cohort CSV before the wizard can proceed to scheduling/review. Therefore an entirely contact-free control campaign cannot be created through the current UI.

Safe control-campaign procedure:

- use only user-authorized internal test recipients;
- do not use production/customer numbers;
- keep retries OFF;
- leave webhook blank for the initial control comparison;
- schedule the campaign for a sufficiently future time, complete creation, then immediately PAUSE it before the calling window;
- do not resume it until the read-only diagnostics are complete;
- after creation, use only the new campaign ID as a diagnostic comparison target.

Do not store the test phone number(s) in repository documentation.

## Fresh control campaign — pre-launch review

The user prepared a new control campaign named `INSUREIT Renewal Controlled 3` using the same `INSUREIT Motor Renewal Assistant` agent v4 and the same managed telephony connection. The uploaded cohort validates successfully with two user-authorized internal test rows, retries are OFF, CPS remains 0.5 calls/sec, and phone-number rotation is OFF. No webhook is configured for this initial control.

The first scheduled calling window shown in the review screen is close to the current time. For safety, do not launch with that near-term start time. Move the start to a comfortably future window (for example the next day), then launch only to create the campaign resource and immediately PAUSE it. The campaign must remain paused before its calling window and before any diagnostic comparison.

## Next safe diagnostic action

Complete creation of `INSUREIT Renewal Controlled 3` only after moving its start time safely into the future. Immediately PAUSE it after creation and provide only the new campaign ID. Do not change the production `SARVAM_RENEWAL_CAMPAIGN_ID` yet. Then compare the fresh campaign's read-only webhook-list response with the original campaign before any live test.

A fresh campaign returning 2xx while the original remains 500 would strongly prove corruption/legacy backend state in the original campaign.

Do not resume either campaign until the provider read path is healthy and the webhook secret has been rotated.

## Provider escalation evidence

If Sarvam support is contacted, include the exact endpoint family, approximate timestamp, and the provider request IDs shown by the diagnostics UI. Do not include the API key or webhook secret. The repeated 500 request IDs should be supplied because Sarvam can trace them server-side.
