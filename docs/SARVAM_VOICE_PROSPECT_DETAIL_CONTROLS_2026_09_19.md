# Voice Prospect Detail, Editable Cohort Profile and Responsive Controls — 2026-09-19

## Goal

Give IT Super User a complete operational prospect workspace behind the Voice Integration control center without weakening the existing authority, privacy or master-data boundaries.

## Implemented behavior

### Responsive controls

Server-form buttons now use a shared pending-state component.

Examples:

- Fetch details -> Fetching…
- Refresh details -> Refreshing…
- Call -> Creating cohort…
- Retry webhook -> Retrying…
- Save profile -> Saving…
- Save calling window -> Saving…
- Test / Pause / Resume controls expose their own pending label

Pending buttons disable themselves while the form submission is in progress and expose `aria-busy`.

### Clickable rows

Both:

- Calling Queue rows
- Recent Voice Attempts rows

are keyboard-accessible clickable rows.

Queue rows open:

`/system/voice-integration/prospects/<opportunity-id>`

Recent attempt rows open the same prospect and anchor to the selected attempt.

Interactive buttons/forms inside each row do not trigger row navigation.

### Prospect detail workspace

The IT-only prospect detail page shows:

1. editable AI calling profile;
2. approved normalized AuthBridge RC/policy details;
3. original imported External Renewal source values;
4. all normalized Sarvam attempt outcomes;
5. provider attempt-event history;
6. the exact privacy-minimized cohort context captured for each new attempt.

Raw Sarvam webhook bodies, transcripts and raw AuthBridge provider payloads remain excluded.

### Editable AI calling profile

Edits are not written back over source evidence.

New `ai_profile_overrides` stores only differences from the current source/AuthBridge baseline.

Editable fields include:

- customer name
- mobile number
- registration number
- manufacturer
- model
- chassis number
- insurer
- policy number
- policy expiry
- previous IDV
- previous premium
- registration date
- manufacturing year
- vehicle class
- fuel type
- engine capacity
- seating capacity
- GVW
- fitness expiry
- PUC expiry
- road-tax expiry
- national-permit expiry
- local-permit expiry

Changing registration number clears the current enrichment readiness and requires a new Fetch details operation against the corrected RC before calling.

### Cohort snapshot

Every newly created local voice attempt captures `cohort_context` before Sarvam submission.

This preserves the exact effective values used for that attempt even if IT edits the prospect later.

The existing Sarvam app-variable contract remains unchanged; only approved variables are submitted to Sarvam.

### AuthBridge normalized detail expansion

The External Renewal enrichment snapshot now retains the wider approved normalized RC/compliance set already used by INSUREIT's protected RC workflow.

Owner identity, relation names, provider-returned addresses and unrelated raw fields are not copied into the External Renewal opportunity.

## Data boundaries

- exact `it_super_user` + `manage_system=approve` remains required;
- Partner users receive no edit/fetch/call authority;
- verified Customer / Vehicle / Policy masters are not modified;
- original External Renewal source values remain preserved;
- raw AuthBridge responses remain only in the existing protected RC cache;
- raw Sarvam transcripts remain unpersisted.

## Schema

Migration:

`supabase/migrations/20260919110000_voice_prospect_editable_profile.sql`

Adds:

- `external_renewal_opportunities.ai_profile_overrides`
- `external_renewal_opportunities.ai_profile_updated_at`
- `external_renewal_opportunities.ai_profile_updated_by`
- `external_renewal_voice_attempts.cohort_context`

## Evidence state

Branch: `feat/voice-prospect-detail-controls`

- implementation: **IMPLEMENTED**
- regression guards: **IMPLEMENTED**
- schema workflow/deploy gate: **IMPLEMENTED**
- PR: **PENDING**
- migration: **NOT APPLIED**
- merge: **PENDING**
- production deployment: **PENDING**
- live UI verification: **PENDING**
