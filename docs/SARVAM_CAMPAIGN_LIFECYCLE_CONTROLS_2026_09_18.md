# Sarvam Campaign Lifecycle Controls — 2026-09-18

> Phase B continuation after the first verified closed-loop calls and Phase A calling-window hardening.
>
> Read with:
> - `docs/SARVAM_CONTROLLED_LIVE_TEST_2026_09_18.md`
> - `docs/SARVAM_OPERATIONAL_CALLING_POLICY_2026_09_18.md`
> - `docs/SARVAM_WEBHOOK_RECOVERY_2026_09_18.md`
> - `docs/VOICE_AGENT_RENEWAL_INTEGRATION_HANDOFF.md`
>
> Never store phone numbers, secrets, transcripts, or raw provider payloads here.

## Purpose

Normal INSUREIT operation should not require an operator to open the Sarvam dashboard merely to pause or resume the approved renewal campaign.

This slice begins Phase B by moving only the non-terminal campaign lifecycle controls into the IT Super User Voice Integration area.

## Provider contract verified before implementation

Sarvam's current Voice Agents API documentation exposes:

- campaign lifecycle states: `scheduled`, `active`, `paused`, `ended`, `cancelled`
- campaign status mutation:
  - `PUT /api/scheduling/v1/orgs/:org_id/workspaces/:workspace_id/campaigns/:campaign_id/status`
  - body `{"action":"pause"}`, `{"action":"resume"}`, or `{"action":"cancel"}`
- provider operating rule for edits: **Pause -> Edit -> Save -> Resume**
- stream cohort is supported for Scheduled, Active and Paused campaigns

INSUREIT intentionally exposes only `pause` and `resume`.

## Implemented architecture

### Server-only lifecycle client

`apps/web-portal/lib/sarvam-campaign-lifecycle.ts`

Responsibilities:

- read the configured campaign lifecycle state
- use server-only `SARVAM_API_KEY`, org, workspace and campaign configuration
- authenticate with the production-proven `X-API-Key`
- normalize only known lifecycle states
- update lifecycle using the documented campaign `/status` endpoint
- allow only `pause` and `resume` through the INSUREIT contract
- apply a provider request timeout
- never expose raw response bodies or credentials

### IT-only mutation route

`POST /api/system/voice-integration/sarvam-campaign-status`

Guards:

- exact `it_super_user` role
- `manage_system` at `approve`
- action allowlist contains only `pause` and `resume`
- provider configuration remains server-side

The route redirects back with sanitized action/result/status query parameters.

### Voice Integration UI

The IT Super User page now:

- reads and displays the configured campaign's provider lifecycle state
- shows **Pause campaign** only when Sarvam reports `active`
- shows **Resume campaign** only when Sarvam reports `paused`
- treats Scheduled, Ended and Cancelled as observation-only
- explicitly states the mutation boundary is **Pause / Resume only**
- does not expose these controls to Partner users

## Deliberate safety boundary

INSUREIT does **not** expose Sarvam's terminal `cancel` action in this slice.

Reason:

- Cancelled is terminal and cannot be resumed.
- An accidental cancel would require a replacement campaign and could strand queued contacts.
- Routine INSUREIT operations only need pause/resume for controlled calling and configuration changes.

Future terminal campaign operations require a separately approved workflow.

## Evidence state

- provider docs reviewed: **VERIFIED**
- lifecycle client: **IMPLEMENTED on feature branch**
- IT mutation route: **IMPLEMENTED**
- IT UI controls: **IMPLEMENTED**
- regression guards: **IMPLEMENTED**
- schema change: **NONE**
- provider lifecycle mutation performed by this development session: **NONE**
- canonical CI: **PENDING**
- merge/deployment: **PENDING**
- production Pause/Resume verification: **NOT YET RUN**

## First production verification after deployment

Use the existing controlled campaign only.

1. confirm the campaign is in a non-terminal state
2. use the IT Voice Integration page to retrieve provider state
3. if Active, click **Pause campaign**
4. verify Sarvam returns `paused`
5. verify no new calls start while paused
6. click **Resume campaign**
7. verify Sarvam returns the expected resumed state
8. do not add a cohort or create a phone call during this lifecycle-only verification
9. record the result here, including any failure state

## Next Phase B slice

After Pause/Resume is verified:

- remove normal operator dependence on CSV bootstrap cohorts
- surface the configured campaign identity/state as the approved reusable execution target
- add controlled campaign-state prechecks to CRM dispatch
- keep Partner single-opportunity streaming unchanged
- prepare a tightly capped API-driven batch orchestration layer only after lifecycle state is dependable

Bulk calling remains out of scope for this slice.
