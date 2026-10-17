# INSUREIT Firebase Customer — Phase C1 RLS, session and Storage release gates
2026-10-17 | DRAFT, source-only | No production migration, Edge deployment or OTA

## Previous verified work
- Phase A draft PR #3211: read-only general Customer eligibility classifier.
- Phase B draft PR #3212: verified IT operator reviewer and shared-phone dual approval; synthetic PostgreSQL passed.
- Phase B3 draft PR #3215: source-only reviewed atomic UID enrollment and closed cohort switch; verified original encrypted password-hash rollback on *disposable* GoTrue, GitHub CI 39009766593. Its exact-head mobile, web and focused CI passed.
- This does NOT establish a production protected Auth backup, offsite retention or production-data restoration. That step still requires an operator-controlled secure PostgreSQL connection and recipient-held encryption key, neither of which is exposed through this chat.

## Production RLS observation — important claim-format mismatch
A read-only examination of production pg_proc and pg_policies found:
- A successful Customer Android Firebase login passes Firebase Admin verification through Edge bridge v7, then uses a Supabase-issued one-time challenge. Android verifyOtp creates a **genuine Supabase Auth JWT** with the original Customer Auth UUID as subject.
- Production helper public.customer_firebase_profile_id currently checks a **Firebase JWT issuer, audience and Firebase UID as subject**. Those do not match the Supabase JWT obtained from the bridge. Therefore Firebase-specific SELECT policies using this helper cannot be relied on for the new login path.
- Other existing PERMISSIVE Customer RLS policies may grant legitimate data access using Supabase auth.uid(), Customer memberships and customer-access functions. This observation does NOT prove a data leak or a data-access failure. An HTTP 200 on a query returning zero rows is not an isolation proof.
- All seven inspected primary tables (profiles, customers, customer_memberships, customer_onboarding_applications, vehicles, policies, claims) have RLS enabled. Multiple permissive policies apply to some tables; review their union, not only the Firebase-specific one.

## Source-only corrective proposal
- Prepared (UNAPPLIED) migration: supabase/migrations/20261017180000_customer_firebase_supabase_session_rls_helper.sql
- Prepared, data-preserving rollback: supabase/rollback/20261017180000_customer_firebase_supabase_session_rls_helper_down.sql
- Proposal changes **only** the helper, requiring a signed Supabase Auth issuer, authenticated role, same exact original UUID in profiles and auth.users, active Customer profile, non-anonymous/non-banned Auth record, matching canonical verified phone, and exactly one approved active immutable Firebase UID link. A Firebase JWT cannot replace the Supabase session. No existing policies, staff grants, Auth credentials, UID mappings or Customer data are modified.
- An independent security review of actual GoTrue issuer claims, all RLS policies and concurrent schema state remains required before applying. Do not infer this migration is necessary for every existing Customer query: fallback RLS policies also exist.

## Synthetic tests — not proof of production tenant isolation
- apps/mobile-app/scripts/customer-firebase-rls-session-local.sh and GitHub verify-customer-firebase-rls-isolation.yml exercise original signed-UUID-style Customer A and B, shared-phone staff denial, wrong Firebase issuer, inactive/duplicated UID mapping, and rollback using **disposable PostgreSQL 17**. This test passed: GitHub Actions run 39011274956.
- apps/mobile-app/scripts/customer-firebase-supabase-refresh-isolation-local.mjs and verify-customer-firebase-gotrue-ab-refresh.yml use **actual disposable Supabase GoTrue**, synthetic Customer A and B, one-time signed Supabase sessions, explicit refreshSession, account switching A->B->A, and synthetic direct auth.uid() RLS. Check the live CI result before claiming a pass.
- The synthetic fixture is *not* a copy of all live production policies, real Customer records, Storage objects, or token auto-refresh after expiry. No cross-tenant production data was read or altered.

## Storage-specific blocker
Read-only production storage.objects policy metadata shows bucket-specific Customer-path SELECT rules for customer-documents, policy-documents, claim-documents. Multiple permissive policies may apply and some permit specifically authorized staff. Before broad migration, test authorized Customer A and B object GET/deny, signed URL expiry and documents for Customer memberships, claims and policies without copying private records. Do not presume bucket authorization passed from the SQL fixture.

## Nonnegotiable rollout gates
1. Owner-held encrypted production Auth backup outside GitHub, decryption/private-key recovery, offsite retention and genuinely rehearsed restoration against a matching local GoTrue schema. Protect password hashes and all user records.
2. Independent Customer ownership proof, consent and restricted IT Super User approval; shared staff phone numbers require distinct second reviewer. No automatic UID enrollment by SMS possession alone.
3. Approved schema and policy review, real Customer A/B cross-tenant data and Storage isolation proof, inactive/revoked-user denial, expired-session refresh, account switching, one-use token replay, and rollback.
4. Explicit future authorization for any production migration, Auth mutation, cohort activation, merge, OTA/APK/AAB, Store release or 2Factor retirement. Current Edge bridge v7 and two-UUID allowlist stay unchanged.

## Next agent
Read AGENTS.md, docs/CUSTOMER_FIREBASE_ALL_CUSTOMERS_ROLLOUT_PLAN_2026_10_17.md, docs/CUSTOMER_FIREBASE_SESSION_HANDOFF_2026_10_16.md, docs/CUSTOMER_FIREBASE_BACKUP_RECOVERY_PLAN_2026_10_16.md and this report. Branch feat/customer-firebase-rls-session-isolation-20261017 stacks on draft PR #3215. Check current branch SHA and both CI runs, open a draft PR targeting #3215 branch and note no deployment. The migration and rollback are source-only.
