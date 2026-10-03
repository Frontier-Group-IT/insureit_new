# Insurer Master Logo Cache Fix — 2026-10-03

## Evidence

- Production Master Data update for `Bajaj General Insurance Limited` successfully stored a new `logo_path`.
- The corresponding PNG exists in the public Supabase `insurer-assets` bucket.
- Production `/api/insurer-logo` requests showed cached/stale responses after the logo replacement.

## Root cause

`/api/insurer-logo?name=...` is a stable name-based URL. The route correctly resolves Master Data `logo_path` first, but it returned the managed-logo redirect with the same public CDN/browser cache policy used for static catalog logos. Replacing a Master Data logo changes the storage object path but not the API URL, so a previous 307 redirect could remain cached after the managed-logo lookup was invalidated.

## Fix

Branch: `fix/insurer-logo-managed-cache-2026-10-03`

- Managed Master Data logo redirects now return `Cache-Control: no-store, max-age=0` plus `Pragma: no-cache`.
- Static bundled insurer-logo redirects retain the existing cache policy.
- The existing `revalidateTag("reference:insurance-companies")` behavior remains unchanged and continues to invalidate the managed-logo lookup map after a Master Data save.
- No schema, RLS, storage permission, insurer master data, policy data, mobile app, Partner app, APK/AAB, or business-rule change.
- Added a focused regression guard at `apps/web-portal/scripts/insurer-logo-managed-cache-regression.mjs`.

## State

**IMPLEMENTED on feature branch; PR/CI/merge/deployment/live verification pending.**
