# Internal Exchange Listing — 2026-10-17

## Status
**IMPLEMENTED ON BRANCH ONLY. NOT MERGED, DEPLOYED, OR APPLIED TO PRODUCTION.**

Branch: `feat/internal-exchange-listing-20261017-v2`

## Requirement
Add an internal website **Exchange → Listing** workflow matching the customer app sell/list journey. Access is limited to:
- IT Super User (`it_super_user`)
- Super Admin (`super_admin`)
- Operations Head (`sales_operations_head`)

Existing **Listing Review** remains unchanged and keeps its existing review permissions.

## Architecture
This implementation is intentionally **code-only and reversible**:
- no Supabase migration;
- no table/constraint/RLS change;
- no customer-app RPC modification;
- no storage-policy modification;
- no APK/AAB/OTA work.

The website uses protected server-only APIs with the existing Supabase service-role client. Every request re-authenticates the signed-in portal user and requires both:
1. exact role membership in the three approved roles; and
2. effective `create_exchange_listings` permission at `edit` level.

## New capability
`create_exchange_listings`

Default role assignment:
- IT Super User: yes
- Super Admin: yes
- Operations Head: yes
- all other roles: no

## Navigation
Exchange now has:
- **Listing** → `/exchange/listings/new`
- **Listing Review** → `/exchange/listings`

## Internal listing journey
1. Select customer
2. Select a vehicle from the customer's fleet
3. Enter condition, odometer, expected price and selling mode
4. Upload six guided photos:
   - Front
   - Rear
   - Left
   - Right
   - Cabin
   - Odometer
5. Review
6. Submit to the existing `pending_review` queue

Vehicles with an active listing in `pending_review`, `live`, `paused`, or `deal_in_progress` are blocked.

Draft/rejected/paused listings for the selected vehicle can be resumed.

## Data behavior
Internal creation writes to the same existing Exchange entities:
- `exchange_listings`
- `exchange_listing_media`
- `exchange_events`
- private `exchange-media` storage bucket

The selected customer remains `seller_customer_id`.
The internal staff profile is recorded as `seller_profile_id` for creation/audit and as the event actor.
Events include `created_via: operations_web`.

Submission does not publish directly. It sets:
`draft/rejected/paused -> pending_review`

The existing Listing Review workflow remains responsible for approval/rejection and publication.

## Safety controls
- server-side exact role allowlist;
- effective permission check;
- customer/vehicle ownership validation;
- active-listing duplicate guard;
- price/odometer/category/selling-mode validation;
- guided-photo label allowlist;
- image type and 15 MB upload limit;
- six required guided photo slots;
- cover-photo requirement;
- audit events for draft create/update, media upload and submit;
- customer-facing Exchange RPCs are not changed or impersonated.

## Files added
- `apps/web-portal/lib/exchange-internal-listing.ts`
- `apps/web-portal/app/api/exchange/listings/internal/route.ts`
- `apps/web-portal/app/api/exchange/listings/internal/media/route.ts`
- `apps/web-portal/app/exchange/listings/new/page.tsx`
- `apps/web-portal/components/exchange/internal-exchange-listing-workspace.tsx`
- `apps/web-portal/scripts/exchange-internal-listing-regression.mjs`

## Files changed
- `apps/web-portal/lib/roles.ts`
- `apps/web-portal/lib/permission-management.ts`
- `apps/web-portal/components/claim-manager/app-navigation.tsx`
- `apps/web-portal/package.json`
- `AGENTS.md`

## Rollback
Because there is no database migration, rollback is simply reverting the eventual merge commit/PR. Existing Exchange rows created after a future deployment are ordinary Exchange business records and are not automatically deleted by a code rollback.

## Pending before merge
- focused regression
- repository CI: regressions, typecheck, lint, production build
- PR review
- user approval to merge
