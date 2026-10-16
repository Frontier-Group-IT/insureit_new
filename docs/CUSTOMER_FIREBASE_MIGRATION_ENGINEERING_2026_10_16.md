# Firebase OTP migration engineering gate — 2026-10-16

## Goal and non-goals
Replace 2Factor SMS OTP with Firebase Phone Authentication for all eligible INSUREIT Customer accounts while preserving existing Supabase Auth UUIDs, RLS, Storage, policies, claims, and memberships. This PR is a **safe diagnosis and migration-preparation slice**, NOT an approved production cutover.

## Verified live findings (read-only, 2026-10-16)
- Android Firebase verification reaches the Supabase session handoff. App hides session errors behind a generic fallback message.
- Production Edge `customer-firebase-session-bridge` v1 exists with a fail-closed `CUSTOMER_FIREBASE_SESSION_BRIDGE_ENABLED` guard. Bridge access logs contain HTTP 503. Verify the exact response code/body via a controlled authorized diagnostic; do not assume every 503 is caused by the flag.
- Production has 23 active Customer Auth users, **0 with an Auth email identity**, and only 2 approved active Firebase identity links (aggregate checks). No Customer Auth identities were modified.
- Session exchange throttle RPC exists. The email-alias exchange in the existing feature PR cannot issue Supabase magiclink sessions to unprovisioned phone-only identities.
- Some numbers can be shared by Customer and staff. Never select the Customer solely by Firebase verified phone or auto-bind to a staff identity.

## Change made in this PR
- Classify known HTTP/status response codes in a static allowlist; log only fixed categories and status. Do not log raw response, phone, UID, OTP, Firebase ID token, Supabase challenge or PII.
- Preserve generic, non-account-enumerating user-facing fallback; preserve existing 2Factor until a verified Firebase-only flow is release-ready.
- Tests for disabled/unavailable backend, identity approval, Auth provisioning, replay/rate limit, mismatched/unexpected responses.

## Remaining implementation gates (NOT COMPLETED by this PR)
1. Review and build a secure, reversible bulk provisioning strategy for existing phone-only Supabase Auth identities using unchanged UUIDs. Existing password hashes require password/recovery threat modeling; **never** issue a deterministic public alias with an unchanged password and do not automatically mutate Auth users on login.
2. Design owner-approved enrollment/UID attestation for all existing Customers, with manual review for shared/recycled phones, signed Firebase token verification, SMS recency/revocation, and server-enforced immutable approved links.
3. Verify backend service account, environment and gateway guards, replay throttle, real Firebase Android SMS, valid same-UUID refreshable Supabase session, account A/B isolation, staff denial, per-Customer RLS, Storage, claim/policy/KYC workflows, multi-account switching and rollback.
4. Implement reusable, dry-run-first Auth migration scripts producing encrypted restricted per-user recovery snapshots. Do not write auth.users until explicitly approved and recovery tested; never include secrets/snapshots in source, logs or artifacts.
5. Add full customer signup, login, change-phone, account recovery and 2Factor removal/cutover verification; maintain feature flags and rollback while cohorts migrate. Run full CI and independent security review before merge.
6. Only with later explicit approval: controlled production canary, then phased account migration, new Android runtime release if native code demands it. **No APK/AAB, OTA, production Auth mutation, main merge or cutover in this PR.**

## Review strategy
Run `node --test apps/mobile-app/scripts/customer-firebase-session-diagnostics.test.mjs`, existing Firebase readiness tests, Mobile/Web/Partner/dependency CI on exact HEAD. This branch is stacked on draft PR #3132 so this PR should target its feature branch rather than main to avoid accidental merging of all unreleased Firebase work.

## Rollback
These changes are mobile logging/classification only; revert this PR commit(s) to remove them. No schema or Auth mutations exist in this branch; database rollback is not applicable. Existing schema/migration plans from PR #3132 are not re-applied here.
