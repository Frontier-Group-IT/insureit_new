# Sarvam Operational Calling Policy — 2026-09-18

> Phase A continuation after the first verified end-to-end controlled calls.
>
> Read with:
> - `docs/SARVAM_CONTROLLED_LIVE_TEST_2026_09_18.md`
> - `docs/SARVAM_OPERATIONAL_HARDENING_2026_09_18.md`
> - `docs/VOICE_AGENT_RENEWAL_INTEGRATION_HANDOFF.md`
>
> Never store phone numbers, secrets, transcripts, or raw provider payloads here.

## Why this slice exists

The live closed loop is proven, so the next production step is to make INSUREIT enforce its own outreach policy instead of relying only on a manually configured Sarvam campaign schedule.

This slice does not enable batch calling. It strengthens the existing single-opportunity flow.

## Implemented policy

INSUREIT now has a server-only renewal calling policy:

- default calling window: **09:00 to 18:00**
- default timezone: **Asia/Kolkata**
- start/end/timezone may be overridden only through server environment variables
- the calling-window check runs before the local voice attempt is created
- outside the window, the Partner request is rejected before any cohort/provider request
- existing database DNC and terminal-state checks remain authoritative
- INSUREIT application-level automatic retry remains disabled
- ambiguous provider delivery remains held for reconciliation instead of being automatically retried

The 09:00–18:00 default matches the controlled Sarvam campaign schedule already used during production validation.

## Server environment options

Optional server-only overrides:

- `SARVAM_RENEWAL_CALL_WINDOW_START`
- `SARVAM_RENEWAL_CALL_WINDOW_END`
- `SARVAM_RENEWAL_CALL_TIMEZONE`

If these are absent or invalid, INSUREIT falls back to the controlled defaults above.

No `NEXT_PUBLIC_` version is permitted.

## Readiness UI

The IT Super User Voice Integration page now surfaces:

- current calling window and timezone
- whether the current time is inside the allowed window
- DND / terminal-state guard status
- INSUREIT automatic retry status

The technical-ready indicator also requires the current request to be inside the calling window.

## Deliberate non-goals

This slice does not:

- add weekday restrictions;
- change Sarvam provider retry configuration;
- resume/pause the campaign automatically;
- create batches;
- create campaigns;
- create or update verified Customer / Vehicle / Policy masters;
- change DNC/terminal-state semantics;
- place a test phone call.

Provider retries remain separately controlled in Sarvam until campaign lifecycle management is wired into INSUREIT.

## Evidence state

- calling-window policy: **IMPLEMENTED on feature branch**
- route enforcement before local attempt: **IMPLEMENTED**
- IT readiness visibility: **IMPLEMENTED**
- regression guards: **IMPLEMENTED**
- schema change: **NONE**
- live phone call: **NOT REQUIRED for this slice**
- canonical CI: **PENDING**
- merge/deployment: **PENDING**

## Next planned phase

### Phase B — campaign lifecycle automation

Continue making INSUREIT the control plane:

1. read/verify the configured campaign lifecycle state from Sarvam;
2. expose sanitized campaign state to IT Super User;
3. add explicit IT-only Pause / Resume controls using Sarvam lifecycle APIs once exact provider endpoints are verified;
4. preserve provider editing rule: Pause -> Edit -> Save -> Resume;
5. do not expose provider administration to Partner users;
6. keep single-opportunity streaming as the only business calling action until monitored production confidence is higher;
7. only later add small capped batch selection.

Sarvam documentation confirms streamed cohorts can be added to Active, Scheduled, or Paused campaigns and supports incremental CRM-driven batches without CSV. This is the architecture INSUREIT should continue toward.
