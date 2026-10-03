# Master Data insurer logo as primary source

## Goal
Ensure any insurer logo uploaded through Master Data becomes the primary logo source immediately across the web portal. Built-in repository logos remain fallback-only when no managed logo is configured.

## Implementation
- The shared `/api/insurer-logo?name=...` resolver checks managed Master Data logos before any built-in/static asset.
- Managed logos are also resolved across known legacy/current insurer aliases when both names map to the same built-in catalog identity. This prevents a historical alias such as an older Bajaj name from bypassing the Master Data upload.
- Managed redirects are `no-store`; immutable uploaded storage objects keep their long-lived cache because every replacement upload receives a new object path.
- `getInsurerLogo()` now accepts an optional version token. The Insurance Company register passes `updated_at`, so an upload/replacement changes the image URL immediately and cannot remain pinned in the browser/Next image cache.
- Static repository logos remain fallback-only when there is no managed logo, and the generic insurer icon remains the final fallback.

## Expected behavior
1. Upload or replace an insurer logo in Master Data.
2. The Insurance Company register immediately requests a new versioned logo URL after the record update.
3. The shared resolver returns the uploaded Master Data logo before any static logo.
4. Historical aliases that map to the same known insurer identity also receive the Master Data logo.
5. Insurers with no managed logo continue to use the existing built-in/static fallback without extra storage/database changes.

## Scope / risk
No schema, RLS, storage policy, policy/customer data, mobile app, APK/AAB, or insurer business-rule changes.
