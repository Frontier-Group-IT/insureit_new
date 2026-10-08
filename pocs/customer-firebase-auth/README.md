# Firebase customer identity mapping — staged migration review
2026-10-08 · **DRAFT / NOT APPLIED**

File: `20261008_identity_mapping_REVIEW_ONLY.sql`.

The migration is deliberately limited to an approved Firebase UID → existing
profile UUID mapping and an independent resolver helper. It does **not**
alter an existing customer's ID, grant access to mapping rows, or replace
current RLS policies. It must NOT run against production as-is.

## Security and compatibility prerequisites

1. Confirm that Firebase third-party JWTs from `insureit-customer-auth`
   are supported by the actual Supabase Auth configuration and that the
   `iss`, `aud`, `sub`, role, expiry and signature have been verified
   by Supabase. Do not trust the client to send an identity claim separately.
2. Verify real Supabase JWT issuer format in a *non-sensitive, authorized*
   testing environment; replace the fallback UUID branch with an explicit
   allowed issuer policy before production. Other third-party providers with
   UUID-like subjects must **not** gain access via that fallback.
3. Verify SECURITY DEFINER ownership, search_path, function EXECUTE grants,
   table grants, default privileges, mapping administration permissions,
   leak-resistant error handling and RLS bypass behavior.
4. Run negative tests for unlinked UID, inactive mapping, inactive profile,
   wrong project, wrong audience, stale/revoked token and duplicate mapping.
5. `auth.uid()` cannot be used directly when Firebase `sub` is not a UUID.
   Every affected RLS policy, Storage rule and customer-facing RPC needs
   identity-aware review before enabling Firebase Data API traffic.
6. Account linking must be an explicitly authorized administrative action,
   never a customer-supplied profile UUID or a first-match phone number.
7. Keep all existing Supabase user/session policies in place until migration
   is proven to preserve existing customer/partner/operations access.
8. Never apply this draft automatically in CI and never embed a Supabase
   service-role key in the mobile client.

The file is a starting point for backend code review, NOT a complete
production-ready RLS migration.
