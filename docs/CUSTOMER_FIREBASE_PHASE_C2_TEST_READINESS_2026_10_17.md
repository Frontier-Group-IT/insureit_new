# Customer Firebase Phase C2 — Test readiness and acceptance gates
Date: 2026-10-17
Branch: feat/customer-firebase-rls-session-isolation-20261017
Status: SOURCE-ONLY VERIFIED; NOT AUTHORIZED FOR NEW PRODUCTION CUSTOMER TESTS

## Verified at source head 9b82e602
- GitHub Actions 39014051988: disposable PostgreSQL 17 RLS Customer A/B and legacy Firebase UID compatibility: success.
- GitHub Actions 39014051986: Mobile CI: success.
- GitHub Actions 39014052018: Web CI: success.
- Previous real disposable GoTrue signed-session explicit refresh and A-B-A switching: 39011229049, success.
- No change to production database, enrollment, Firebase Edge v7, app distribution or staff/2Factor sign-in.

## Scope of completed implementation
- A compatibility-safe DRAFT `customer_firebase_profile_id()` replacement retains the original Firebase JWT UID mapping branch used by the existing production pre-request hook and adds a strictly separate signed Supabase issuer/original UUID Customer session branch.
- Tests cover Customer A/B isolation through the Firebase-specific policy, staff with Customer phone denied, inactive/duplicated UID link denial and restoration of the old helper. A dedicated test checks legacy Firebase UID approval, wrong UID, and wrong phone denial.
- The helper remains SECURITY DEFINER with the existing grants; it has NOT been applied and must be reviewed in context of all existing permissive RLS policies.

## Release blockers that cannot be bypassed by test CI
1. Recipient-controlled encrypted production Auth backup, independent offsite retention and isolated matching-GoTrue restore proof.
2. An authenticated independent ownership/consent review for each historic Customer; shared staff/Customer numbers require a second active reviewer.
3. Cross-Customer access denial and legitimate self-access in actual production RLS/Storage with approved consenting test Customers, including policy, vehicle, claim, onboarding files and signed URL expiry.
4. Native Android Firebase token / installed runtime test, automatic refresh after real expiry, one-use challenge replay, credential recovery, logout/account switching, revoked and blocked-user denial.
5. Explicit sign-off before production migration, Auth alias/UID mutation, enrollment expansion, app OTA/AAB or merge.

## Manual testing sequence after gates are met
- Confirm installed internal Android build uses 0.3.2 (11), Expo `firebase-internal`; do not send SMS to unapproved accounts.
- Test existing approved canary Customer ending 1634, which previously completed Firebase -> same Supabase UUID and persisted after restart. Do not treat this as proof of expiry refresh or general readiness.
- For each independently approved Customer A/B: sign in with genuine Firebase phone OTP, verify exact original Supabase UUID, self profile/policy/vehicle/claim visible, other Customer inaccessible, private files inaccessible, session refresh and switching safe, and legacy staff 2Factor unchanged.
- Attempt negative cases under controlled authorization only: revoked mapping, duplicated mapping, stale/replayed token, staff phone collision, inactive Customer and signed URL expiry. Record sanitized result codes, never OTP, token, phone number, Firebase UID, passwords, document bytes.
- Halt on any mismatched UUID, unauthorized access, revoked account access, session inconsistency, unsanctioned Auth identity mutation or degraded staff/legacy login. Retain 2Factor fallback and roll back through approved owner-reviewed procedure.

## Verdict
Ready for REVIEW and ISOLATED CI test, not ready for general live rollout or new real-customer test. Phase C2 policy parity testing still requires broader reproduction of production permissive rules and real authorized access checks. PR remains draft and unmerged.
