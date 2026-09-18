# Sarvam Production Calling Queue Preview — 2026-09-18

> Real-production control-plane continuation after single-opportunity calling, operational calling-window enforcement, campaign lifecycle controls, campaign dispatch precheck, and Partner readiness alignment.
>
> This slice is intentionally read-only and does not enable bulk AI calling.
>
> Never store phone numbers, secrets, transcripts, or raw provider payloads here.

## Purpose

Before INSUREIT enables any multi-opportunity AI calling workflow, IT Super User needs a deterministic view of which External Renewal opportunities are presently eligible under the production CRM rules.

The preview establishes that eligibility model without creating attempts, cohorts, or calls.

## Current initial-outreach eligibility

The preview examines active External Renewal opportunities whose policy expiry is between today and the next 30 days.

A record is **Eligible** only when all of the following are true:

- opportunity is active
- mobile is present
- CRM status is `new` or `contact_attempted`
- no future follow-up is already scheduled
- no active AI voice attempt exists

A record is held when any of these conditions apply:

- missing mobile
- terminal / DNC state
- future follow-up already scheduled
- active voice attempt
- CRM stage outside the initial-outreach set

## Why the first production queue is intentionally narrow

The normal CRM contains later-stage records such as connected, interested, quote requested/shared and follow-up.

Those records require different conversation goals and timing. The first production queue therefore includes only initial-outreach stages rather than silently re-calling later-stage prospects.

Follow-up calling should be introduced as a separate production queue with its own script/agent behavior and timing rules.

## IT Super User visibility

The Voice Integration page now shows:

- total active opportunities due in the next 30 days
- eligible count
- held count
- first 20 queue-preview rows
- short internal opportunity reference only
- policy expiry
- CRM stage
- eligible/held state
- normalized hold reason

The preview does **not** render customer identity or phone number.

## Safety boundary

This slice cannot:

- create a local voice attempt
- call `cohorts/stream`
- create a Sarvam cohort
- resume/pause a campaign
- place a phone call
- retry a phone call
- update an opportunity
- write verified Customer / Vehicle / Policy masters

It is a read-only production planning surface.

## Relationship to bulk-calling rule

The External Renewal Voice Integration instructions still state that bulk AI calling remains disabled until the webhook-recovery path is verified.

This queue preview does not weaken that rule.

It establishes the eligibility/control-plane layer now so that, once the remaining recovery constraint is resolved or explicitly superseded by an approved production policy, the future capped batch-dispatch slice can use a reviewed deterministic queue instead of inventing eligibility at dispatch time.

## Evidence state

- server-only eligibility model: **IMPLEMENTED on feature branch**
- IT queue preview UI: **IMPLEMENTED**
- regression guards: **IMPLEMENTED**
- database migration: **NONE**
- provider mutation: **NONE**
- calls/cohorts created: **NONE**
- canonical CI: **PENDING**
- merge/deployment: **PENDING**

## Next planned production slices

1. **Follow-up queue definition**
   - define later-stage eligibility separately from initial outreach
   - respect `next_follow_up_at`
   - use appropriate agent objective

2. **Production queue auditability**
   - optional batch/selection audit records before any dispatch capability is enabled
   - record who selected what and why without storing raw provider payloads

3. **Hard-capped dispatch**
   - only after the bulk-calling gate is explicitly cleared
   - small maximum count
   - IT-controlled launch
   - recheck every opportunity server-side at dispatch time
   - stop on ambiguous provider state
   - kill-switch and campaign lifecycle controls remain authoritative

4. **Automation**
   - only after monitored capped batches prove stable
   - no autonomous production launch before that evidence exists
