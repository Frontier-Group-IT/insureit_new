# Insurer Master Logo Upload Handoff — 2026-10-01

## Status

**IMPLEMENTED on branch `feature/insurer-master-logo-upload-2026-10-01`; NOT MERGED, NOT APPLIED, NOT DEPLOYED.**

This change lets Master Data managers upload or replace an insurer logo directly from Add/Edit Insurance Company instead of requiring a GitHub asset commit for every new insurer.

## Architecture

The feature is intentionally backward-compatible:

1. `public.insurance_companies.logo_path` stores only the managed Storage object path.
2. Supabase Storage bucket `insurer-assets` stores public branding images.
3. Writes remain server-only through the existing Supabase admin client and require `manage_master_data` edit capability.
4. The shared `getInsurerLogo(name)` helper points web UI to `/api/insurer-logo?name=...`.
5. The resolver order is:
   - uploaded Master Data logo;
   - existing bundled `/assets/insurers/...` logo;
   - generic insurer icon.
6. Existing GitHub insurer assets remain unchanged and continue to work as fallback.

This avoids changing every policy/claim/report component separately and prevents existing insurer branding from breaking.

## Upload controls

- Accepted MIME types: PNG, JPEG, WebP.
- Maximum file size: 2 MB.
- Server-side MIME and size validation is mandatory even though the browser file picker is restricted.
- Object names are generated; the user's original filename is not used as a storage key.
- Each object is scoped under `<insurance_company_id>/...`.
- Replace/remove operations delete only paths inside that insurer's folder.
- Raw logo bytes are never written to audit logs; audit records contain only the stored `logo_path` reference.

## Schema migration

Pending migration:

`supabase/migrations/20261001131500_insurance_company_logo_upload.sql`

It is additive only:

- nullable `insurance_companies.logo_path text`;
- public `insurer-assets` bucket;
- 2 MB bucket limit;
- PNG/JPEG/WebP bucket MIME allow-list.

No production schema/storage change has been applied while the PR is unmerged.

## Cache/invalidation

The logo route caches the small name → `logo_path` master map for five minutes using the existing `reference:insurance-companies` cache tag. Add/edit actions revalidate that tag, so a successfully saved logo is eligible to refresh immediately while browser/CDN cache remains short-lived.

## Rollback

Application rollback is straightforward: revert the feature PR and `getInsurerLogo` returns to bundled static mapping behavior. If the migration has already been applied, the nullable column and unused bucket are non-breaking and can remain during rollback. Managed logo objects can be removed later after confirming no deployed code references them.

Do not drop the column/bucket as part of an emergency code rollback unless storage usage has first been checked.

## Verification

Focused regression:

`apps/web-portal/scripts/insurer-master-logo-upload-regression.mjs`

It guards the upload field, server validation, capability boundary, managed/static/generic resolver order, storage scoping and migration constraints. The canonical web PR gate must still pass typecheck, lint, production build and existing regressions before merge.

## Scope exclusions

- No mobile/Expo/native code change.
- No APK/AAB build or publication.
- No insurer UUID changes.
- No policy, claim, accounting or OCR business-rule changes.
- No portal credential storage changes.
