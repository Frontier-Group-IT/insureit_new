# Vehicle Manufacturer direct logo upload

## Goal
Make Vehicle Manufacturer Add/Edit branding behave like Insurance Company Master: upload a logo/icon directly from the form, use that uploaded asset as the primary manufacturer logo, and retain repository assets only as fallback.

## Implementation
- Added PNG/JPG/WebP logo upload to the shared Add/Edit manufacturer form (2 MB max).
- Added edit-time replacement/removal handling with cleanup of superseded managed assets.
- Added public `manufacturer-assets` Supabase bucket migration with the same size/type restrictions as insurer assets.
- Managed uploads are stored behind the same-origin `/api/manufacturer-logo` route so existing Next Image consumers can use `vehicle_manufacturers.logo_path` without remote-host configuration changes.
- Uploaded managed logo wins over repository fallback. Repository logo selector is retained as fallback-only.
- Existing vehicle-manufacturer matching, aliases, brands, segments, RC/OCR logic, and RPC contract are unchanged.

## Deployment note
This PR includes a required Supabase migration. Production deployment must apply/verify the migration before the web build is promoted.
