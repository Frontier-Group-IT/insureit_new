# Exchange listing visibility gate — 2026-10-17

## Request
In Exchange > Listing Review add an Action column to the right of Review, shown only to IT Super User, with a compact Enable/Disable badge. Disabled listings must disappear from customer apps, enabled eligible listings may appear again.

## Current implementation (branch only)
- New `exchange_listings.is_enabled` boolean default true, separate from approval status.
- IT Super User-only column and action; server-side role check enforces this even on forged requests.
- Customer `exchange_marketplace_feed` and `exchange_listing_detail` SECURITY DEFINER RPCs are gated in reversible migration. Disabled listings are excluded from feed and direct detail for customer users; staff can still moderate.
- Existing listing status, published timestamps, vehicles, policies, and sellers are untouched.
- CI regression added.

## Deployment sequencing
Do NOT deploy frontend before migration: page queries the new column.
1. Review migration against the current production RPC definitions and apply migration in the controlled release.
2. Deploy web portal, run smoke tests on IT and non-IT roles, and customer mobile/web feed and direct detail.
3. Confirm disabled live listing disappears, re-enabled listing reappears, existing pending/rejected listings never appear merely because enabled.
4. Verify no unauthorized role can change visibility via action.
No APK/AAB, OTA or user-data modification is needed.

## Limitations / safeguards
The migration dynamically rewrites the two existing SECURITY DEFINER function definitions and deliberately aborts if expected anchors are not found, preventing accidental replacement of unrelated logic. Validate on production using a transaction/dry-run where possible because no staging DB is available. A passing static regression is NOT proof of live visibility. The code is not merged/deployed.
