# Customer profile avatar camera parity — 2026-10-12

## Change
Adds the employee-style camera badge to the Customer Portal profile menu avatar. Selecting it opens an image picker for JPG, PNG or WebP (maximum 2 MB). A selected photo immediately appears in the header and dropdown. Photos use the existing employee-compatible browser-local `insureit:user-avatar:<auth-user-id>` key to avoid cross-user mix-ups on the same browser. Customer protected layout passes the server-verified auth user ID; no service role or elevated permission is introduced.

## Scope and limitation
This is **browser-local photo storage**, just like the current employee menu. It is not synced to another device, stored in Supabase, or displayed in other profile surfaces. Browser storage cleared = photo lost. No changes to profile table, auth, customer registration, policies, media buckets, database, RLS, native apps or data migrations.

## QA / release / rollback
`apps/web-portal/scripts/customer-profile-camera-regression.mjs` is wired to Verify web portal CI. Manual browser tests needed: select photo, reload, sign out/in, different users in same browser, invalid type, file >2 MB, private mode/storage-denied, narrow mobile menu. Do not merge/deploy until approved. Rollback by reverting PR; browser-local storage entries can persist unless cleared by the user.
