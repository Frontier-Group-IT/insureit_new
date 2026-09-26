# INSUREIT Private Voice Agent Workspace

Before changing this workspace, read `docs/INSUREIT_PRIVATE_VOICE_AGENT_ROLLOUT.md` and the parent `apps/web-portal/app/system/voice-integration/AGENTS.md`.

## Phase 2 training-library rules

- Preserve the working Sarvam managed-agent system as an independent fallback. Do not modify Sarvam dispatch, cohort, webhook, retry, calling-window or production prompt behavior from this workspace.
- Private calling remains disabled. Training-library work must never call a telephony, STT, TTS or LLM provider.
- Historical Sarvam tables are read-only sources for private training curation. Never write private state into `voice_campaigns`, `voice_campaign_members`, `external_renewal_voice_attempts` or `external_renewal_voice_attempt_events`.
- Write curated private examples only to the isolated `private_voice_*` tables.
- Do not fabricate raw conversation turns. Current production history persists normalized outputs and call summaries, not raw transcripts.
- Remove customer-identifying literals before a historical summary/objection is stored in the private training library. Do not persist phone numbers, RC numbers, raw provider payloads or unnecessary identity.
- Keep training, validation and permanent-test candidates deterministic and separated. Never train on the permanent-test split.
- Any future raw transcript corpus must use a separate privacy-reviewed import flow and must not be silently mixed into production history.
- The Training Library staging action must remain IT-Super-User-only and explicit; page load must never mutate the dataset.
- Update `docs/INSUREIT_PRIVATE_VOICE_AGENT_ROLLOUT.md` after every major implementation, experiment, realization or dataset-quality finding.
