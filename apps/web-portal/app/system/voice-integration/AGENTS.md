# Voice Integration Admin Area

Before changing this route or any related Sarvam renewal integration code, read:

- `docs/VOICE_AGENT_RENEWAL_INTEGRATION_HANDOFF.md`
- `docs/SARVAM_VOICE_WORKFLOW_CURRENT_STATE_2026_09_15.md`
- `docs/SARVAM_DIAGNOSTIC_EVIDENCE_2026_09_16.md`
- `docs/SARVAM_CONTROL_CAMPAIGN_DIAGNOSTIC_2026_09_16.md`
- `docs/SARVAM_PRODUCTION_READINESS_SUCCESS_2026_09_17.md`
- `docs/SARVAM_OPERATIONAL_HARDENING_2026_09_18.md`
- `docs/SARVAM_WEBHOOK_RECOVERY_2026_09_18.md`
- `docs/SARVAM_SUPPORT_EVIDENCE_2026_09_18.md`
- `docs/SARVAM_OPERATIONAL_CALLING_POLICY_2026_09_18.md`
- `docs/SARVAM_CAMPAIGN_LIFECYCLE_CONTROLS_2026_09_18.md`
- `docs/SARVAM_CAMPAIGN_DISPATCH_PRECHECK_2026_09_18.md`
- `docs/SARVAM_CONTROLLED_LIVE_TEST_2026_09_18.md`
- `docs/SARVAM_RENEWAL_AGENT_CONTRACT.md`
- `apps/web-portal/app/partner/renewals/external/AGENTS.md`

Treat `docs/SARVAM_VOICE_WORKFLOW_CURRENT_STATE_2026_09_15.md` as the current continuation record for agent version, controlled campaign binding, portal activation state, live-test evidence and the active Sarvam authentication blocker. Read `docs/SARVAM_DIAGNOSTIC_EVIDENCE_2026_09_16.md` for the repeated production provider-response evidence and original-campaign isolation results. Read `docs/SARVAM_CONTROL_CAMPAIGN_DIAGNOSTIC_2026_09_16.md` for the fresh control-campaign comparison and its safety state. Read `docs/SARVAM_PRODUCTION_READINESS_SUCCESS_2026_09_17.md` for the production proof that the configured campaign reaches normal `cohorts/stream` validation with `X-API-Key`, plus the remaining webhook-secret rotation gate. Keep these records current after any material provider-authentication, campaign, agent-version, webhook or portal-dispatch change. Treat `docs/SARVAM_CONTROLLED_LIVE_TEST_2026_09_18.md` as the durable evidence record for the first closed-loop production telephony tests, the missing-webhook failure, successful retry, and manual reconciliation lesson.

This area is IT Super User only. Preserve the exact `it_super_user` role check plus `manage_system` at `approve` access. Do not expose provider secrets, API keys, webhook secrets, raw provider payloads, customer phone numbers, or transcripts here.

The calling window is an IT Super User operational control. The Voice Integration Window card may edit start/end time through the protected system route; persisted values must remain server-only, must not be writable by authenticated clients directly, and IT dispatch must re-read the persisted setting immediately before creating an attempt.

The page may report whether required server-side configuration is present and may show non-secret provider identifiers in masked form. Read-only diagnostics may show sanitized HTTP status/error classification and provider request/correlation identifiers, but never raw response bodies or credentials. It must not turn Partner users into Sarvam administrators.

Do not add bulk calling or autonomous campaign controls until the single-opportunity production lifecycle is verified end to end. `won` remains a Policy Intake conversion state and must never be set by the voice agent.


## Mandatory Voice Agent trial logging protocol

Every material Voice Agent workflow trial must leave a repository-visible Markdown note before the trial is considered closed, whether the trial succeeds or fails.

For each new provider/API/campaign/telephony/webhook/CRM/reconciliation experiment:
- update the current voice handoff and the most relevant dated evidence note;
- record what was tried, what changed, exact evidence state, failure root cause when known, cleanup/reconciliation, and the next safe step;
- keep `AGENTS.md` as a short index/rule surface and put detailed chronology in `docs/`;
- never store phone numbers, secrets, raw transcripts, full webhook bodies, or unnecessary customer identity;
- do not overwrite a failed result with a later success; preserve the durable learning and clearly mark the later superseding state.

This protocol is mandatory because future agents must be able to reconstruct the Voice Agent production journey without relying on chat memory.


## Voice trial continuity

Every material provider/API/campaign/telephony/webhook/CRM/reconciliation trial must update the relevant dated Markdown evidence note and `docs/VOICE_AGENT_RENEWAL_INTEGRATION_HANDOFF.md` before closure, whether the trial succeeds or fails. Preserve durable failure lessons. Never store phone numbers, secrets, raw transcripts, or full webhook payloads.

- `docs/SARVAM_PARTNER_PRODUCTION_READINESS_2026_09_18.md`

- `docs/SARVAM_PRODUCTION_QUEUE_PREVIEW_2026_09_18.md`

- `docs/SARVAM_PRODUCTION_CONTROL_CENTER_2026_09_18.md`

## Current production authority model

AI voice calling actions are IT-Super-User-only. Partner users may view normalized AI status/results but must not receive a call-start action or an API path that can reach Sarvam. All future Partner self-service is deferred until separately approved. The production Voice Integration page should remain compact and operations-oriented; experimental diagnostics belong on dedicated diagnostic routes/docs.
