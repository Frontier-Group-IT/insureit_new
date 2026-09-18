# Sarvam Partner Production Readiness — 2026-09-18

> Production UX continuation after the verified single-call lifecycle, Phase A calling-window enforcement and Phase B campaign lifecycle controls.
>
> Never store phone numbers, secrets, transcripts, or raw provider payloads here.

## Purpose

The Partner External Renewal UI previously showed AI calling availability mainly from the global kill switch. That was no longer sufficient once INSUREIT began enforcing a real calling window and provider campaign lifecycle state.

The Partner UI must reflect the same production readiness rules enforced by the server dispatch route so users are not invited to click a call action that the server will reject.

## Implemented readiness contract

New server-only helper:

`apps/web-portal/lib/sarvam-partner-dispatch-readiness.ts`

It evaluates, in order:

1. INSUREIT global AI-calling kill switch
2. INSUREIT calling window
3. configured Sarvam campaign lifecycle state

Partner-visible readiness reasons are normalized to:

- `ready`
- `disabled`
- `outside_calling_window`
- `campaign_paused`
- `campaign_terminal`
- `campaign_unavailable`

No Sarvam credentials or provider administration details are exposed to Partner users.

## Partner list behavior

External Renewal list now uses the server-calculated readiness rather than the kill switch alone.

The AI Outreach banner shows:

- **AI calling available** only when the complete dispatch gate is ready
- **AI calling unavailable** otherwise
- a short operator-facing explanation, such as outside calling hours or temporarily paused

The normal workflow remains single-opportunity calling from each opportunity detail page.

## Partner detail behavior

The External Renewal opportunity detail page now uses the same production readiness helper.

The **Call with AI** button is available only when all existing local opportunity rules plus the global dispatch readiness are satisfied.

When unavailable, the action area shows the actual server-side operational reason instead of the generic text `AI calling unavailable`.

Existing local guards remain unchanged:

- closed opportunities
- active/in-progress voice attempt
- missing mobile
- DNC / terminal / duplicate protections in the scoped RPC

## Why this matters for production

UI and dispatch route now converge on the same policy:

```text
kill switch
  -> calling window
  -> approved Sarvam campaign lifecycle
  -> opportunity-specific guards
  -> one local attempt
  -> one API-streamed cohort user
```

This reduces rejected clicks, makes administrative Pause visible to Partner users without exposing provider controls, and removes any practical dependency on the manually uploaded bootstrap CSV for normal Partner calling.

## Deliberate non-goals

This slice does not:

- create batch calling
- create a new campaign
- delete the original manual CSV cohort
- mutate campaign lifecycle
- change database schema
- add autonomous retries
- expose provider identifiers to Partner users

## Evidence state

- production readiness helper: **IMPLEMENTED on feature branch**
- Partner list integration: **IMPLEMENTED**
- Partner detail integration: **IMPLEMENTED**
- regression guards: **IMPLEMENTED**
- schema change: **NONE**
- provider mutation: **NONE**
- canonical CI: **PENDING**
- merge/deployment: **PENDING**

## Next real production slice

The next safe production step is an IT-Super-User **calling queue / eligibility preview**, not autonomous bulk dispatch.

That slice should:

- query only External Renewal opportunities
- show exactly which opportunities are eligible/ineligible and why
- apply DNC, terminal, mobile, active-attempt, calling-window and campaign-state rules
- make no call by itself
- establish the future batch-selection control plane without violating the current rule that bulk AI calling remains disabled until webhook-recovery behavior is resolved or explicitly re-approved
