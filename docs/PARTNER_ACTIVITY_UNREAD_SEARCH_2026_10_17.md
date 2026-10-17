# Partner Activity unread/search — 2026-10-17

## Status
**IMPLEMENTED ON BRANCH ONLY. NOT MERGED, MIGRATED, PUBLISHED, OR DEPLOYED.**

Branch: `feat/partner-activity-unread-search-20261017`

## Requirement
Partner app Activity / "What changed":
- show unread count badge on the Home header bell;
- below Recent activity add one compact universal search box;
- directly below search add compact joined Unread / Read / All tabs with counts;
- persist read state across app restarts/devices;
- opening an unread activity marks it read and decreases the badge/counts.

## Implementation
### Persistent read receipts
Adds:
- `public.partner_activity_read_receipts`
- primary key: `(auth_user_id, event_key)`
- RLS: signed-in user can only select/insert/update/delete their own receipts;
- service role retains administrative access.

No policy/claim/intake/learning activity source row is changed. Read state is stored separately.

Activity identity is:
`kind + entity_id + event_at`

This intentionally treats a newer claim/intake event timestamp as a new activity event.

Migration:
`supabase/migrations/20261017150500_partner_activity_read_receipts.sql`

Rollback:
`supabase/rollbacks/20261017150500_partner_activity_read_receipts.sql`

### Partner app
`apps/partner-app/lib/engagement.ts`
- stable event-key helper;
- load read receipts;
- mark one activity read;
- calculate unread count from up to 100 current activity items.

`apps/partner-app/app/activity.tsx`
- universal search across type/title/customer/meta;
- joined Unread / Read / All segmented tabs;
- live counts;
- default Unread when unread exists, otherwise All;
- optimistic mark-read when an activity item is opened.

`apps/partner-app/components/partner-screen.tsx`
- Home header bell displays unread badge;
- badge refreshes when Home regains focus;
- badge caps at `99+`.

## Safety
- no change to `partner_app_activity()` source query;
- no change to policies, claims, intakes, learning attempts, or customer data;
- additive table only;
- RLS scoped to `auth.uid()`;
- reversible migration;
- no APK/AAB creation;
- no OTA publish in this branch.

## Pending
- repository CI/typecheck/lint;
- migration review/application;
- merge approval;
- Partner OTA publish approval;
- real-device visual/UAT verification.
