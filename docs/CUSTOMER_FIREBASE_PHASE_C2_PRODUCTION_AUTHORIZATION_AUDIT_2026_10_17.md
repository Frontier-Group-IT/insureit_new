# Firebase Customer Phase C2 — authorization audit

Date: 2026-10-17. Scope: read-only production metadata verification, project ilzhsfqqjyppzzvfscmh. No customer records or file contents accessed. No production changes.

## Verified observations

- RLS enabled for profiles, customers, memberships, onboarding, vehicles, policies, claims, Firebase UID mappings, and storage.objects.
- Customers, vehicles, policies and claims each have five permissive SELECT policies. Each policy must be considered jointly with the other permitted policies and related SECURITY DEFINER functions.
- The deployed customer_firebase_profile_id helper expects a Firebase issuer and UID. The Android session bridge issues a genuine Supabase session with the original Customer UUID.
- The live customer_firebase_data_api_pre_request function calls that helper for incoming Firebase-issued tokens. Consequently, replacing the helper with the Supabase-issuer-only version proposed by PR #3216 could break remaining Firebase-JWT data requests. This is a compatibility risk, not evidence of a live incident. Do not apply the proposed migration by itself.
- Storage has multiple permissive SELECT rules including customer, claims, policy and staff access paths. Metadata examination is not proof of cross-account isolation, private-bucket configuration, or signed-URL expiry.
- The existing helper and customer_firebase_can_read_customer are executable by authenticated, not anon; the pre-request function is executable by both.

## Required release gates

1. Design and test a compatibility-safe transition, without opening direct Firebase-JWT database access or breaking old clients.
2. Test all applicable permissive rules using real disposable Supabase sessions for A/B, staff/customer shared-phone, revocation and account switching.
3. Test authorized and denied Storage downloads, file paths, signed URLs, and role exceptions; do not export real files.
4. Independently verify encrypted production Auth backup and matching-schema restoration before customer Auth mutation.
5. Require separate authorization for migration application, enrollment, deployment, merge or mobile publication.

Status: audit completed, migration unapplied, release blocked pending compatibility and end-to-end verification.
