# Sarvam Voice Operational Hardening — 2026-09-18

> Continuation record for the first production-hardening slice after the single-opportunity live closed loop was verified.
>
> Do not store phone numbers, secrets, raw transcripts, or raw webhook payloads here.

## Trigger

The first controlled live test proved that a PSTN call can complete while INSUREIT remains stuck at `queued` when the Sarvam campaign webhook is absent. The second controlled test proved the full webhook -> retry-safe provider event -> normalized CRM -> Partner UI path.

That failure/success pair established two production requirements:

1. IT Super User needs visible webhook-health evidence.
2. Active voice attempts that stop changing must be visible for reconciliation, but must **not** be automatically failed or retried because provider delivery can be ambiguous.

## Implementation in this slice

Branch: `feat/sarvam-voice-operational-hardening`

### IT Super User Voice Integration page

The page now reads both:

- recent `external_renewal_voice_attempts`
- recent `external_renewal_voice_attempt_events`

It adds:

- a **Webhook callbacks** health card based on persisted normalized provider events;
- the timestamp of the latest normalized callback event;
- an activation-gate item showing whether any callback has been observed;
- a **Reconciliation attention required** warning when a currently active attempt has not changed for more than 60 minutes;
- a per-attempt **Health** badge in the recent-attempt table.

The 60-minute threshold is observation-only. It does not mutate attempt state.

## Safety boundaries

This slice intentionally does **not**:

- call Sarvam;
- create or stream cohorts;
- retry calls;
- fail stale attempts;
- reconcile provider state automatically;
- expose customer identity or phone numbers;
- expose provider secrets;
- expose raw webhook payloads or transcripts;
- write verified Customer / Vehicle / Policy data;
- change the existing kill switch;
- change database schema.

A stale active attempt can represent an intentionally paused/scheduled campaign or an ambiguous provider delivery. Therefore visibility is safe; automatic retry/failure is not.

## Regression update

The External Renewal voice regression is updated to:

- assert the live Sarvam submission uses `X-API-Key`;
- protect webhook-health visibility;
- protect stale-attempt visibility;
- protect the rule that stale attempts are not automatically failed/retried.

## Evidence state

- UI and regression changes: **IMPLEMENTED on feature branch**
- schema change: **NONE**
- database mutation from this slice: **NONE**
- canonical CI: **PENDING**
- merge: **PENDING**
- production deployment: **PENDING**

## Next safe slice after this one

After this observational hardening is verified:

1. add a controlled reconciliation workflow for stale attempts using provider attempt/interaction identifiers or provider API/export evidence;
2. require explicit IT Super User action for reconciliation;
3. never correlate by phone number;
4. preserve the existing result-projection RPC so reconciliation follows the same idempotency and CRM mapping contract as webhooks;
5. define approved calling hours, retry policy, DND/opt-out policy and monitoring before any controlled batch calling.
