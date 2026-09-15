# Sarvam Voice Agent Workflow — Current State (2026-09-15)

This is the current continuation record for the INSUREIT motor-renewal Sarvam Voice Agent work. Read it together with `docs/VOICE_AGENT_RENEWAL_INTEGRATION_HANDOFF.md` and `docs/SARVAM_RENEWAL_AGENT_CONTRACT.md` before changing the Sarvam renewal integration.

## Evidence-state rule

Keep these states separate: configured, implemented, merged, deployed, provider-authenticated, call-submitted, call-connected, webhook-processed, CRM-projected and operationally verified. Do not call the workflow operational until the complete INSUREIT -> Sarvam -> telephony -> webhook -> CRM loop is verified.

## Current Sarvam agent

- Agent name: `INSUREIT Motor Renewal Assistant`.
- Agent/App ID: `INSUREIT-Re-d369ce6e-1bcd`.
- Current committed agent version used for the controlled campaign: **v4**.
- The prompt must represent INSUREIT only; never introduce Sarvam, the selected voice, model/provider name or a fictitious human identity.
- If directly asked whether the caller is automated/AI, answer truthfully and briefly.
- Humanization requirements: short Indian-English/Hindi/Hinglish turns, adaptive acknowledgements, identity/convenience confirmation, natural silence/unclear-audio repair, friendly `ji`/`sir`/`ma'am` only when appropriate, and no questionnaire-like stacking of questions.
- `Namaste` may be used only in the first greeting. It must never be reused for silence nudges, unclear-audio recovery, interruption recovery or later turns. Recovery phrases should use natural forms such as `Hello sir, meri awaaz aa rahi hai aapko?`, `Rajesh ji, aap line par hain?`, or `Sorry sir, last part thoda clear nahi aaya...`.
- The agent must not invent premium, IDV, NCB, insurer terms, quotation, discount, policy issuance, payment, WhatsApp/SMS delivery, callback scheduling, CRM updates or other external actions unless a connected tool confirms them.
- Customer-facing language must not expose implementation phrases such as `test environment`, `tool not connected`, `backend`, `API`, or `CRM not connected`.

## Agent variable contract

Input variables currently used:

- `customer_name`
- `vehicle_make_model`
- `vehicle_number`
- `current_insurer`
- `policy_expiry_date`
- `previous_idv`
- `previous_premium`

Output variables currently expected:

- `call_disposition`
- `customer_interest`
- `follow_up_required`
- `follow_up_time`
- `customer_objection`
- `call_summary`

The current agent labels include the newer values normalized by INSUREIT, including `renewed_elsewhere` and interest labels `interested`, `maybe`, `not_interested`. PR #1852 aligned the webhook normalization contract with these current Sarvam outputs.

## Knowledge base

A comprehensive motor-renewal knowledge base was prepared for upload to Sarvam. Its purpose is to answer general customer questions about motor insurance, renewal, NCB, IDV, premium factors, deductibles, common add-ons, claims, break-in inspection, insurer switching, documents, endorsements, financed vehicles, EV/flood/theft/total-loss topics, objections, payment/fraud safety and escalation boundaries.

Knowledge-base rules:

- general concepts may be explained;
- customer-specific premium/IDV/NCB/claim/insurer terms must come from a verified quotation, policy or connected system;
- knowledge-base text must never become an insurer-specific promise;
- if the verified policy/quotation conflicts with generic knowledge, the verified source wins.

## Controlled telephony campaign

Current reusable controlled campaign:

- Campaign name: `INSUREIT Renewal Controlled 2`.
- Campaign ID: `INSUREIT-Re-e2468e47-50a8`.
- Agent version: v4.
- Telephony connection: Sarvam Managed (Vobiz).
- Outbound number is configured in Sarvam; do not copy it into repository documentation.
- Campaign is intentionally **PAUSED** while provider authentication is diagnosed.
- Retry configuration for the controlled pilot was set OFF.
- The initial cohort contains only two user-authorized internal test recipients. Do not store their phone numbers in repository context.
- Do not resume the campaign until INSUREIT provider authentication and queue submission are verified.

## Production environment binding

Expected server-side production variables:

- `SARVAM_API_KEY`
- `SARVAM_ORG_ID`
- `SARVAM_WORKSPACE_ID`
- `SARVAM_RENEWAL_CAMPAIGN_ID=INSUREIT-Re-e2468e47-50a8`
- `SARVAM_RENEWAL_APP_ID=INSUREIT-Re-d369ce6e-1bcd`
- `SARVAM_RENEWAL_APP_VERSION=4`
- `SARVAM_RENEWAL_WEBHOOK_SECRET`
- `SARVAM_RENEWAL_CALLING_ENABLED=true` only for the controlled activation window

Never store actual API keys, webhook secrets or full sensitive identifiers in repository documentation.

The IT Super User readiness page currently reports schema ready, Sarvam configuration present and Partner AI calling enabled. Presence is not proof that the provider accepts authentication.

## Portal dispatch architecture

The intended final operator flow is portal-driven, not CSV-driven:

```text
External Renewal Opportunity
  -> authenticated Partner `Call with AI`
  -> INSUREIT creates local attempt UUID
  -> INSUREIT streams one Sarvam cohort user
  -> user_identifier = local attempt UUID
  -> Sarvam/Vobiz places call
  -> Sarvam completion webhook
  -> INSUREIT validates campaign/app/secret
  -> idempotent normalized result
  -> External Renewal CRM state / human follow-up
```

Do not correlate results by phone number. Do not merge external renewal data into verified Customer/Vehicle/Policy masters. Policy Intake remains the conversion boundary.

The long-term design is that users create/manage business campaigns in INSUREIT while Sarvam is the telephony execution layer. Normal operations should not require manual Sarvam CSV upload or manual campaign creation. First prove the reusable execution campaign end to end; then automate campaign lifecycle from INSUREIT.

## Controlled test records

Two isolated External Renewal Opportunity records were created for the two user-authorized internal test numbers. They remain in the external-renewal domain only and must not create/update verified Customer, Vehicle or Policy masters. No production customer calling is authorized by their existence.

## Live-call evidence already obtained in Sarvam

A prior Sarvam-dashboard controlled pilot successfully dialed the two internal test recipients. One call ended near the greeting; another completed a full renewal conversation and produced structured outputs. This proves the Sarvam agent + Vobiz path can place calls, but it does **not** prove portal-driven dispatch or webhook/CRM closure.

## Current blocker: scheduling API authentication

INSUREIT production readiness currently reaches the Sarvam Voice Agents scheduling API but receives HTTP **401**.

Observed facts:

- Production Vercel variables are present.
- The configured Sarvam workspace ID matches the workspace shown in Sarvam Settings.
- The active API key is shown under that same workspace.
- PR #1864 (`Fix Sarvam campaign API authentication fallback`) merged as `793bde9032ac868f3fe4cba590c0332d54fa95f5` and is deployed/READY on Vercel.
- That fix tries `api-subscription-key` first and retries with `Authorization: Bearer` only after a definitive 401.
- The production connection test still returns 401 after that deployment and after the user refreshed/recreated the API key in the confirmed workspace.
- Therefore do not keep rotating credentials or guessing. The next step is deterministic deep diagnostics.

## Deep-diagnostics plan

Add an IT-Super-User-only, read-only **Run Deep Diagnostics** action. It must never place a call, stream a cohort, mutate a Sarvam campaign, expose credentials, log secrets, phone numbers, transcripts or raw customer/provider payloads.

Diagnostics should distinguish these layers:

1. **Core Sarvam API-key probe** against `api.sarvam.ai` using a non-mutating authenticated request. A deliberately nonexistent pronunciation-dictionary ID is acceptable: valid authentication should reach resource resolution (typically 404), while an invalid API key should be rejected (typically 403).
2. **Voice Agents scheduling probe with `api-subscription-key`** against the configured campaign read-only webhook-list endpoint.
3. **Voice Agents scheduling probe with `Authorization: Bearer`** against the same read-only endpoint.

Show only sanitized status, safe error classification/error code, content type and provider request/correlation header if available. Never render response bodies verbatim.

Interpretation target:

- core auth rejected -> API key/credential issue;
- core auth accepted/reaches resource layer, but scheduling 401 for both forms -> Voice Agents scheduling permission/auth-contract issue rather than a bad key;
- scheduling 403 -> authenticated but unauthorized for the resource/product/workspace;
- scheduling 404 -> organization/workspace/campaign binding mismatch;
- scheduling 2xx -> provider auth works and the existing readiness probe/path needs correction.

## Immediate continuation

1. Keep campaign `INSUREIT-Re-e2468e47-50a8` PAUSED.
2. Implement and deploy the read-only deep diagnostics through the normal branch/PR/CI path.
3. Run diagnostics once from `/system/voice-integration`.
4. Use the three layer results to identify the exact provider-auth failure before changing any more credentials.
5. Only after provider auth passes, queue the two authorized test opportunities from INSUREIT while the campaign remains paused; verify local attempt/cohort state; then resume the campaign for the actual two-phone test.
6. Verify webhook ingestion, idempotency and CRM projection before any broader campaign automation.
