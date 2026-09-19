# Sarvam Agent Refinement — Phase 2: Structured Sales Memory

## Goal

Make repeat calls continue from prior sales discovery without re-asking questions already answered.

## New Sarvam output variables

Add these under **Output variables**:

- `insurer_preference` enum: `same_insurer, compare_options, open_to_any, unknown`
- `preferred_insurer` string
- `claim_status` enum: `no_claim, claim_reported, unknown`
- `renewal_priority` enum: `premium, coverage, balanced, unknown`
- `requested_addons` string — comma-separated controlled values only
- `discussed_topics` string — comma-separated controlled values only
- `human_requested` enum: `yes, no`
- `next_step_agreed` enum: `quote, callback, human_transfer, no_action, closed`

Allowed requested_addons tokens:
`zero_dep, consumables, engine_protect, gearbox_cover, key_cover, tyre_cover, rti, rsa, ncb_protection`

Allowed discussed_topics tokens:
`zero_dep, consumables, engine_protect, gearbox_cover, key_cover, tyre_cover, rti, rsa, ncb, insurer_comparison, premium, idv, claim_process`

## Extraction rules

- Output only facts clearly stated or confirmed in the current call.
- Never infer a preference merely because the agent mentioned an option.
- `requested_addons` includes only add-ons the customer explicitly wants or asks to include.
- `discussed_topics` includes topics materially discussed/answered so a later call can avoid restarting them.
- `claim_status = no_claim` only when the customer clearly confirms no claim.
- `claim_status = claim_reported` only when the customer clearly reports a claim.
- `renewal_priority = balanced` only when the customer clearly wants both reasonable premium and coverage.
- `human_requested = yes` only when the customer explicitly asks for a person/human.
- `next_step_agreed` must reflect the final agreed next action, not an action merely offered by the agent.

## Persistence

INSUREIT stores this normalized object in `external_renewal_voice_attempts.sales_memory`.

Raw transcripts are still not persisted.

On the next connected call, INSUREIT folds this structured memory into `previous_conversation_context`. The agent must treat those fields as already-known context and must not re-ask them unless the customer corrects or changes the answer.

## Prompt patch

```text
STRUCTURED SALES MEMORY — HIGH PRIORITY

Prior-call memory may include:
- insurer preference
- preferred insurer
- claim status
- renewal priority
- requested add-ons
- already discussed topics
- whether human help was requested
- agreed next step

Treat these as already-known facts from prior connected conversations.

Do not ask the customer again for any value that is already clearly known.
Do not re-explain a topic already marked as discussed unless:
1. the customer asks about it again,
2. the prior answer was incomplete,
3. the current situation has changed.

If the customer changes a preference in the current call, the current answer overrides old memory immediately.

Never say "as per our system you said..." or read memory fields aloud.
Use the memory silently to continue the conversation naturally.
```
