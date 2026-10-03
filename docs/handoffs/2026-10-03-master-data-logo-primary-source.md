# Master Data insurer logo as primary source

## Goal
Ensure any insurer logo uploaded through Master Data becomes the primary logo source immediately across the web portal. Built-in repository logos remain fallback-only when no managed logo is configured.

## Implementation
- Insurance Company register rows now include `logo_path` from `insurance_companies`.
- Register rendering prefers the managed Supabase public URL when `logo_path` is present.
- The existing `/api/insurer-logo?name=...` resolver remains the fallback for insurers without a managed logo, preserving static catalog and generic fallback behavior.
- The managed asset URL carries the row `updated_at` as a version query parameter so replacement uploads are cache-busted immediately without disabling caching globally.

## Expected behavior
1. Upload or replace an insurer logo in Master Data.
2. The same insurer row immediately renders the uploaded asset after the page refresh/navigation.
3. Other portal locations that use the shared insurer-logo API continue to prioritize managed logos and fall back to static assets where no managed asset exists.

## Scope / risk
No schema, RLS, storage policy, policy/customer data, mobile app, APK/AAB, or insurer-name matching changes.
