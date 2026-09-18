# External Renewal Voice Integration Instructions

Before modifying anything under Partner External Renewal Opportunities, read:

- `docs/VOICE_AGENT_RENEWAL_INTEGRATION_HANDOFF.md`
- root `AGENTS.md`
- `docs/AUTHBRIDGE_RC_HANDOFF.md` when enrichment or RC lookup is involved

## Non-negotiable boundaries

- External renewal opportunities remain isolated from verified INSUREIT Customers, Vehicles and Policies until the normal Policy Intake conversion path creates verified business.
- INSUREIT owns workflow state. Sarvam is a conversation/telephony provider, not the source of truth for Partner ownership or CRM state.
- Partner users may use business-facing AI outreach actions but must not receive Sarvam API keys, telephony credentials, campaign configuration, agent/version controls, webhook secrets or provider administration.
- IT Super User owns provider configuration, approved campaign/version, caller number, retry/call-window policy, integration enable/disable control and diagnostics.
- Never start an AI call from a browser-supplied Partner ID or phone number. Re-fetch the scoped opportunity server-side through the authenticated Partner commercial scope.
- `do_not_contact`, terminal opportunities and an existing active voice attempt must block new outbound calls.
- A failed/busy/no-answer provider attempt must never become Connected, Interested or another sales outcome.
- The voice agent must never set `won`. Won remains exclusively controlled by the existing Policy Intake -> final Policy lifecycle.
- Raw transcripts and complete provider webhook payloads are not retained by default. Store only the approved normalized call outcome fields.
- AuthBridge enrichment is server-side, controlled and cache-aware. Do not bulk-enrich all external opportunities or silently write enriched data into verified masters.
- Bulk AI calling stays disabled until the single-opportunity lifecycle, idempotency, opt-out handling and webhook recovery path are verified.

Update `docs/VOICE_AGENT_RENEWAL_INTEGRATION_HANDOFF.md` whenever this contract, schema, provider mapping, production state or continuation plan materially changes.

## Current production readiness source

Partner AI calling availability must come from the server-side production dispatch readiness contract (kill switch + calling window + configured Sarvam campaign lifecycle), not from the kill switch alone. See `docs/SARVAM_PARTNER_PRODUCTION_READINESS_2026_09_18.md`.

## Production queue preview

IT Super User may use the read-only production queue preview to inspect initial-outreach eligibility, but this must not be confused with enabled bulk calling. The current preview rules and hold reasons are documented in `docs/SARVAM_PRODUCTION_QUEUE_PREVIEW_2026_09_18.md`.

## AI voice authority

Current production rule: Partner users are status-only for AI voice calling. Do not render `Call with AI`, do not expose provider lifecycle controls, and do not allow the legacy Partner voice-call endpoint to reach Sarvam. IT Super User owns all AI calling actions until a later explicitly approved Partner self-service phase. See `docs/SARVAM_PRODUCTION_CONTROL_CENTER_2026_09_18.md`.
