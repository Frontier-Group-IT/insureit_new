# Sarvam Voice Agent Workflow — Current State (updated 2026-09-16)

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

The IT Super User readiness page reports schema ready, Sarvam configuration present and Partner AI calling enabled. Presence is not proof that the provider accepts authentication.

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

## Authentication investigation history

INSUREIT production readiness reached the Sarvam Voice Agents scheduling API but returned HTTP **401**.

Observed before deep diagnostics:

- Production Vercel variables were present.
- The configured Sarvam workspace ID matched the workspace shown in Sarvam Settings.
- The API key was shown as Active under that same workspace.
- PR #1864 (`Fix Sarvam campaign API authentication fallback`) merged as `793bde9032ac868f3fe4cba590c0332d54fa95f5` and was deployed/READY on Vercel.
- That fix tries `api-subscription-key` first and retries with `Authorization: Bearer` only after a definitive 401.
- The production connection test still returned 401 after that deployment and after the API key was refreshed/recreated in the confirmed workspace.

## Deep diagnostics — implemented and production verified

PR #1876 (`Add read-only Sarvam deep diagnostics`) merged as `5c20826022d6e53331a9ddfb5b84ecef139bf752`.

Deployment evidence:

- GitHub Actions production deploy run `34967973064`: **success**.
- Vercel production deployment `dpl_2yNZPhRKuEMuex5exMQ94RE3XsQ7`: **READY**.
- The deployed diagnostics route is `/system/voice-integration/diagnostics` and remains IT-Super-User only.
- Diagnostics are read-only and do not place calls, stream cohorts or mutate the Sarvam campaign.

### Production diagnostic result — 2026-09-16

The user ran **Run Deep Diagnostics** once in production while the campaign remained paused.

Observed results:

1. **Core Sarvam API key probe**
   - HTTP **403**
   - classification: `api_key_rejected`
   - provider error code: `invalid_api_key_error`

2. **Voice Agents scheduling — `api-subscription-key`**
   - HTTP **401**
   - classification: `authentication_rejected`

3. **Voice Agents scheduling — Bearer**
   - HTTP **401**
   - classification: `authentication_rejected`

The portal also returned provider request IDs for all three probes. Those IDs are intentionally not persisted here because they are transient diagnostics evidence rather than durable configuration.

### What this proves

- The configured production credential is **not accepted by the core `api.sarvam.ai` probe**; Sarvam explicitly returned `invalid_api_key_error`.
- Both tested authentication styles are also rejected by the Voice Agents scheduling API.
- Therefore the current blocker is still at the **provider credential/authentication contract layer**. Do not resume the campaign and do not attempt customer dispatch yet.
- The result does **not** by itself prove whether the Sarvam Voice Agents product uses a different key type, a separate scheduling credential, a product-specific API entitlement, or whether the configured key value is malformed/stale in production. The next step is to verify the exact current Sarvam Voice Agents API authentication contract before changing more credentials.

## Immediate continuation

1. Keep campaign `INSUREIT-Re-e2468e47-50a8` **PAUSED**.
2. Do not queue any of the controlled test opportunities yet.
3. Verify the current official Sarvam Voice Agents / scheduling API authentication requirement and whether the Voice Agents workspace key shown in the dashboard is valid for both `api.sarvam.ai` and `apps.sarvam.ai` scheduling endpoints.
4. If Sarvam documents a separate credential/permission for scheduling, configure that server-side without exposing it to the browser or repository.
5. After any credential/auth-contract correction, rerun **Run Deep Diagnostics** before using `Call with AI`.
6. Only after provider authentication passes, queue the two authorized test opportunities from INSUREIT while the campaign remains paused; verify local attempt/cohort state; then resume the campaign for the actual two-phone test.
7. Verify webhook ingestion, idempotency and CRM projection before any broader campaign automation.
