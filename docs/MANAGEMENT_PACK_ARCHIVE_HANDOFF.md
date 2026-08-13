# INSUREIT Management Pack Archive Handoff

Date: 2026-08-13

## Scope

This phase follows the Month-End Management Pack and adds forward-looking immutable month-end archive support.

Primary live-view route:
- `/reports/management-pack`

Archive route:
- `/reports/management-pack/archive`

Frozen CSV export uses the existing route:
- `/reports/export/management-pack?snapshot=<snapshot-id>`

## Why this phase exists

The Management Pack combines month-period Business / Distribution / Finance / Claims data with current-state Renewal and Operations exposure. Without a frozen snapshot, reopening an old month later would recalculate those current-state exposure sections using newer operational data.

The archive preserves the exact pack payload shown at month close so future viewing does not silently rewrite the historic pack.

## Integrity rules

- Snapshots are immutable after creation.
- Snapshots are private to the profile that created them.
- The saved payload already contains the creator's authorized hierarchy/self/organization scope.
- A profile can have at most one snapshot for each month.
- The UI allows `Close Month` only on the actual final calendar day of the current month in Asia/Kolkata.
- Past months cannot be backfilled using today's renewal/compliance state and presented as true month-end data.
- Current-month snapshots cannot be created early.

## Database

Live Supabase migration:
- `20260813084726_management_pack_snapshot_archive`

Repository migration:
- `supabase/migrations/20260813084726_management_pack_snapshot_archive.sql`

Table:
- `public.management_pack_snapshots`

Key columns:
- `id`
- `owner_profile_id`
- `month`
- `scope_mode`
- `snapshot_version`
- `snapshot jsonb`
- `captured_at`

Security:
- RLS enabled.
- all table privileges revoked from `public`, `anon`, and `authenticated`.
- service role has server-side access.
- live privilege smoke confirmed `anon_select=false`, `authenticated_select=false`, `service_select=true`.
- snapshot row count was 0 at implementation time because 2026-08-13 is not month-end.

## Application files

- `apps/web-portal/lib/reports/management-pack-archive.ts`
- `apps/web-portal/app/reports/management-pack/actions.ts`
- `apps/web-portal/app/reports/management-pack/archive/page.tsx`
- `apps/web-portal/app/reports/management-pack/page.tsx`
- `apps/web-portal/app/reports/export/management-pack/route.ts`

## UI behavior

Management Pack now exposes:
- Archive button
- `Close Month` button only when the selected month is eligible for exact month-end capture
- `Frozen Pack` link when the viewer already has a snapshot for that month
- Frozen badge and capture timestamp when a snapshot is open
- Live View link from a frozen pack
- frozen CSV export

The Archive page lists only the signed-in viewer's own snapshots, with month, authorized scope, capture timestamp, version and Open action.

## Authorization

Entry still requires effective `view_reports`.

Snapshot creation always builds the pack through `loadManagementPack(profile, { month })`, so Business / Distribution / Finance / Claims / Renewals / Operations still use the established scoped report loaders. Governance is included only when the creator also has effective `manage_users` permission.

Snapshot reads always filter by both snapshot ID and `owner_profile_id`; a user cannot open another profile's frozen payload by guessing an ID.

Frozen CSV uses the same owner-filtered server loader and has no client-side database access path.

## Verification evidence before production gate

Feature head before concurrent main movement:
- `87fa7b63440ceb22301a97bfca9a9950f7484578`

Verify web portal run:
- `31683846939`

That run passed all access-control/security regressions, OCR regressions, TypeScript and lint. It was cancelled during the production-build step only because `main` moved from a concurrent production-trigger commit.

The explicit combined production deployment requested by the user must therefore rely on the protected production workflow's compulsory verification gate against the final release snapshot before invoking Vercel.

## Deployment intent

The user explicitly requested that the previously verified Management Pack and this Month-End Archive phase be deployed together after the archive phase is completed.
