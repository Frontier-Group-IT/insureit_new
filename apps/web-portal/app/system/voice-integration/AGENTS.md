# Voice Integration Admin Area

Before changing this route or any related Sarvam renewal integration code, read:

- `docs/VOICE_AGENT_RENEWAL_INTEGRATION_HANDOFF.md`
- `apps/web-portal/app/partner/renewals/external/AGENTS.md`

This area is IT Super User only. Preserve the exact `it_super_user` role check plus `manage_system` at `approve` access. Do not expose provider secrets, API keys, webhook secrets, raw provider payloads, customer phone numbers, or transcripts here.

The page may report whether required server-side configuration is present and may show non-secret provider identifiers in masked form. It must not turn Partner users into Sarvam administrators.

Do not add bulk calling or autonomous campaign controls until the single-opportunity production lifecycle is verified end to end. `won` remains a Policy Intake conversion state and must never be set by the voice agent.
