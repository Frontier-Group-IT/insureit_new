# Sarvam Campaign Dispatch Precheck — 2026-09-18

> Phase B continuation after verified Pause/Resume lifecycle control.
>
> This note records the dispatch safety rule added before creating any new INSUREIT voice attempt.
>
> Never store phone numbers, secrets, transcripts, or raw provider payloads here.

## Trigger

Production lifecycle verification established that:

- Pause returned HTTP 200 and provider state `paused`.
- Resume returned HTTP 200 and provider state `scheduled` because the test occurred outside the configured campaign window.
- INSUREIT had no active voice attempts during either lifecycle test.

Sarvam documentation allows cohort streaming to `active`, `scheduled`, or `paused` campaigns. INSUREIT intentionally applies a stricter business rule: an explicit administrative Pause must also stop new Partner dispatches from being created.

## Implemented rule

Before INSUREIT creates the local voice-attempt UUID, the Partner `Call with AI` route now verifies the configured provider campaign state.

Allowed for new dispatch:

- `active`
- `scheduled`

Blocked before attempt creation:

- `paused` — administrative stop
- `ended`
- `cancelled`
- unknown/unavailable provider state

The calling-window check still runs first.

Therefore the effective dispatch gate is:

```text
kill switch enabled
  -> inside INSUREIT calling window
  -> Sarvam campaign state is active or scheduled
  -> scoped/DNC/terminal/duplicate RPC checks
  -> create local attempt UUID
  -> stream one cohort user
```

## Why Paused is stricter than Sarvam's stream API

Sarvam technically accepts cohort streaming while a campaign is paused.

INSUREIT does not use that capability for the Partner `Call with AI` action because Pause represents an administrative stop. Allowing new Partner requests to accumulate while paused would make the control ambiguous and could produce a burst of calls when the campaign is resumed.

Future batch-preloading, if ever approved, must use a separate IT-controlled workflow rather than weakening this rule.

## Safety properties

- no database schema change
- no provider mutation
- no call is placed by this precheck
- provider state is checked before local attempt creation
- provider state failure cannot leave a stale active local attempt
- existing DNC, terminal-state and one-active-attempt RPC rules remain unchanged
- Partner users still receive no provider administration controls

## Evidence state

- implementation: **IMPLEMENTED on feature branch**
- regression guards: **IMPLEMENTED**
- canonical CI: **PENDING**
- merge/deployment: **PENDING**
- live call test: **NOT REQUIRED for this slice**

## Next planned slice

After this precheck is deployed:

- expose the reusable configured campaign as the single approved execution target
- remove normal workflow dependence on manually uploaded CSV cohorts
- prepare a small, hard-capped IT-controlled API batch orchestration design
- keep Partner single-opportunity calls unchanged
- do not enable autonomous bulk calling yet
