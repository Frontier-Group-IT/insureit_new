# IT Voice Quick Add RC — 2026-09-19

## Goal

Let IT Super User place an ad-hoc renewal prospect into the Voice Integration Calling Queue by entering only:

- RC number
- mobile number

INSUREIT then reuses the existing AuthBridge/cache enrichment path to fetch the approved normalized vehicle, insurer and policy context.

## UX

The Calling Queue header contains a compact **Quick add RC** control.

When expanded, it shows only:

- RC number
- mobile number
- **Add & fetch**

The action shows a real pending state: **Adding & fetching…**

On success, IT is redirected to the prospect detail page where the fetched AuthBridge values and editable AI calling profile can be reviewed before Call.

## Server behavior

1. exact `it_super_user` + `manage_system=approve` is required;
2. RC and Indian mobile number are validated server-side;
3. current External Renewal partner scope must resolve to exactly one published partner context;
4. if an active non-terminal opportunity with the same normalized RC already exists:
   - no duplicate opportunity is created;
   - the entered mobile is stored as an AI-profile override;
   - the existing prospect is explicitly promoted into the IT calling queue;
   - AuthBridge enrichment is refreshed;
5. otherwise INSUREIT creates an isolated External Renewal opportunity under a dedicated **IT Voice Quick Add** source batch;
6. that batch remains `validated`, not `published`, so it is not treated as a normal Partner import batch;
7. the new opportunity is tagged `voice_queue_source = it_quick_add`;
8. AuthBridge enrichment runs immediately through the existing cache-first service;
9. Quick Add rows remain in the IT Calling Queue even when their placeholder source date is outside the ordinary imported 30-day window;
10. Sarvam calling is still a separate explicit IT action after review.

## Data safety

Quick Add does not create or update verified Customer, Vehicle or Policy masters.

The source record contains only the entered RC/mobile plus existing isolated External Renewal metadata. Approved normalized AuthBridge fields remain in `rc_enrichment_details`; raw provider payloads remain only in the existing protected RC cache.

A synthetic source date is required by the legacy External Renewal schema for the isolated quick-add row. That synthetic date is never used as the AI policy-expiry value. For Quick Add prospects, Sarvam policy expiry comes only from AuthBridge enrichment or an explicit IT override.

Terminal/suppressed RCs cannot be re-added to bypass DNC/closed-state protection.

## Schema

Migration:

`supabase/migrations/20260919114500_voice_quick_add_queue_source.sql`

Adds:

- `voice_queue_source`
- `quick_add_by_auth_user_id`
- `quick_added_at`

Allowed queue sources:

- `import`
- `it_quick_add`

## Evidence state

- branch: `feat/voice-quick-add-rc`
- implementation: **IMPLEMENTED**
- PR/CI: **PENDING**
- migration: **NOT APPLIED**
- merge/deployment/live verification: **PENDING**
