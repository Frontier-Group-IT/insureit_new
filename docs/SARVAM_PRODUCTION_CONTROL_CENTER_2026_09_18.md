# Sarvam Production Control Center — 2026-09-18

> Production UX/control-plane replacement for the experimental Voice Integration page.
>
> This note also records the temporary authority model: **IT Super User controls all AI voice calling actions. Partner users are status-only.**
>
> Never store phone numbers, secrets, transcripts, or raw provider payloads here.

## Why this change was required

The original `/system/voice-integration` page accumulated diagnostics, readiness checks, recovery experiments, raw configuration-presence rows, queue previews and lifecycle controls during the integration phase.

That page was useful while proving Sarvam connectivity, cohort streaming, telephony, webhook projection and recovery behavior, but it had become too dense for normal production operations.

The production page is therefore rebuilt as a compact control center focused on what an operator actually needs.

## Production authority model

Current approved authority:

- **IT Super User:** full AI voice calling control
- **Partner users:** no ability to start AI voice calls
- Partner users may still view normalized AI call state/results inside External Renewal opportunities
- Partner CRM interaction and Policy Intake workflows remain unchanged

This is intentionally temporary. Partner self-service may be introduced later through a separately approved production phase.

## Server enforcement

Partner action removal is enforced at both UI and API layers.

### Partner UI

The Partner External Renewal list/detail:

- no longer evaluate AI dispatch readiness for action authority
- no longer render `Call with AI`
- show AI status/results only
- clearly mark AI outreach as IT-managed

### Partner voice endpoint

`POST /api/partner/external-renewals/[id]/voice-call`

is retained only as a compatibility barrier. It does not call Sarvam and redirects with the message that AI voice calling is controlled by IT Super User.

This prevents manually posting the old Partner endpoint from bypassing the UI restriction.

## IT-only dispatch path

New route:

`POST /api/system/voice-integration/dispatch`

Required access:

- exact `it_super_user`
- `manage_system` at `approve`

Dispatch flow:

```text
IT Super User selects eligible queue row
  -> global kill switch check
  -> INSUREIT calling-window check
  -> approved Sarvam campaign-state check
  -> service-side External Renewal eligibility recheck
  -> active-attempt recheck
  -> local voice attempt with requested_by_auth_user_id
  -> one Sarvam streamed cohort user
  -> submission state persisted
  -> webhook/result projection continues unchanged
```

The IT helper reads only isolated External Renewal opportunity data and writes only the existing External Renewal voice-attempt tables.

Verified Customer / Vehicle / Policy masters remain untouched.

## Production page redesign

The Voice Integration page is now organized into compact production sections.

### Header

- Voice Integration
- short production-control subtitle
- IT Super User-only badge

### Health strip

Compact status tiles:

- Provider
- Approved campaign state
- Kill switch
- Webhook
- Partner actions: Disabled

### Production control

Direct action buttons:

- Test Connection
- Pause Campaign
- Resume Campaign
- Queue
- Recovery
- Refresh

Buttons are state-aware; unsupported lifecycle actions render disabled.

### Access & policy

Compact operational indicators:

- Controller: IT Super User
- Partner: No actions
- Calling window
- DND / terminal guard
- Auto retry: Disabled

### Calling queue

Read-only eligibility preview becomes the IT execution surface.

Eligible rows expose **Call** only when the complete production dispatch gate is ready.

Held rows remain non-actionable.

No customer name or phone number is shown in this IT queue preview.

### Campaign

Compact campaign status panel:

- provider state
- state verification
- calling window
- webhook health
- last callback
- Partner control state

### Recent attempts

Compact operational table:

- submitted state
- connectivity
- disposition
- health
- updated timestamp
- webhook retry for completed provider attempts

Stale attempts remain visible for reconciliation.

## Removed from the main production page

The main page no longer dedicates large sections to:

- raw per-environment configuration-presence rows
- webhook URL instructional text
- experimental activation-gate prose
- separate verbose webhook-recovery explanation
- provider diagnostic narratives

Existing deep diagnostic routes remain available to IT for troubleshooting, but they are no longer the primary production UX.

## Safety invariants retained

- server-only Sarvam credentials
- X-API-Key provider auth
- global kill switch
- 09:00–18:00 Asia/Kolkata calling window by default
- campaign state must be Active or Scheduled for dispatch
- DNC and terminal suppression
- one active voice attempt per opportunity
- ambiguous provider delivery is not auto-retried
- webhook provider-attempt idempotency
- no raw transcript persistence
- no verified Customer/Vehicle/Policy writes
- no Partner AI call authority

## Evidence state

- production control-center redesign: **MERGED + DEPLOYED**
- IT-only dispatch route/helper: **MERGED + DEPLOYED**
- Partner AI action removal: **MERGED + DEPLOYED**
- Partner API bypass barrier: **MERGED + DEPLOYED**
- regression guards: **VERIFIED** by canonical Verify web portal #4182
- database migration: **NONE**
- production deployment: **READY** — PR #2084 merged as `8e5afeba02075404a3ddcad78f8b0e53a359356d`; Vercel `dpl_5mzUSXDo4AnQojLzF26wMqCyfrMz` aliased to `portal.insureit.in`
- live IT-dispatch verification: **PENDING**

## Next verification after deployment

1. confirm Partner External Renewal detail has no `Call with AI`
2. manually POSTing the old Partner voice endpoint must not create a call
3. confirm IT Voice Integration page is compact and shows Partner actions Disabled
4. inside the approved calling window, select one authorized eligible opportunity from IT queue
5. click **Call**
6. verify exactly one local attempt and one API cohort
7. verify live telephony and webhook projection
8. document the result before expanding to any multi-record workflow

## Future expansion

Partner self-service is explicitly deferred.

Before re-enabling any Partner-triggered AI calling, require a separate approved design covering:

- role/capability boundary
- per-Partner limits
- audit trail
- calling-hour enforcement
- queue ownership
- DNC/terminal safeguards
- duplicate suppression
- operational support/recovery
