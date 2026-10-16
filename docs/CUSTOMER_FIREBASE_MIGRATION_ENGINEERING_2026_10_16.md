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

## 2026-10-16 identity migration implementation extension
- Added pure fail-closed enrollment preflight checking independently attested Firebase signature/revocation, recent phone-auth event, fixed project, exact Customer Auth UUID/profile/phone match, immutable UID mapping, explicit independent identity proof, and shared-phone review. This preflight never inserts or approves UID mappings; an eligible new UID remains `manual_approval_required` until a separately audited operator action.
- Added pure Auth alias preflight requiring existing approved UID link, unchanged Auth UUID/phone, non-overwrite of real Auth email, protected out-of-band recoverable snapshot, rehearsed rollback, credential rotation, and recovery/password sign-in risk review.
- Hardened existing manual single-user alias script: dry-run stays default, production `--apply` now additionally requires five explicit recovery/risk attestations and per-target UUID confirmation; no account mutation was performed. These environment attestations are procedural guardrails, **not** substitute for independent verified backup/recovery or security review.
- Added test cases for stale/unsigned tokens, shared phones, staff/Customer mismatches, UID conflicts, missing approval and recovery gates. A dedicated GitHub Actions workflow runs these tests on the PR.
- **Still required:** secure end-to-end Firebase JWT attestation service integrated into audited enrollment approvals, durable server-side enrollment audit and concurrency controls, independently reviewed Auth rollback mechanism, safe credential recovery path, full native-device/Supabase refresh/RLS acceptance tests. Do NOT call migration production-ready. This change contains no applied schema migration; rollback is reverting branch commits. Any future schema write requires a separately reviewed reversible migration.

## 2026-10-16 atomic enrollment and recovery rehearsal implementation
- New PREPARED, NOT APPLIED migration `20261016162000_customer_firebase_enrollment_atomic.sql` creates a service-role-only `customer_firebase_enroll_approved` transaction. It locks Customer UUID and Firebase UID, verifies an active Customer and canonical Supabase Auth phone, verifies active IT Super User operator, rejects conflicting links and inserts the approved link plus one restricted administrative evidence audit atomically. Explicit function-only rollback included.
- Server-only `commitVerifiedEnrollment` requires signed/revocation-checked Firebase Admin identity, out-of-band independently approved matching Customer, privileged operator and a fixed-format evidence digest, then calls the atomic RPC. It is **not a deployed public endpoint**; never treat caller-provided flags as proof of an actual authorization outside a trusted server.
- Disposable local GoTrue recovery workflow exercises original identity/password login, Auth alias + random password rotation, and a snapshot/transactional restoration of original GoTrue encrypted password and Auth identities, then verifies original login and unchanged UUID. THIS IS ONLY A SYNTHETIC LOCAL REHEARSAL. Production must rely on independently verified encrypted database-level Auth backups, approval and rehearsed recovery; Admin API exports do not capture existing password hashes.
- Disposable local PostgreSQL enrollment workflow applies only prepared schemas into synthetic Supabase database, tests service-only RPC authorization, one-and-only-one audit, conflict denial, idempotency, concurrent attempts and function rollback.
- An early local enrollment workflow discovered an unterminated PL/pgSQL body; corrected in branch commit `b325ba9e`. Do not rely on earlier green static contract tests for SQL compilation. Record final results for the exact latest HEAD only.
- These features do NOT make Firebase-only login work yet. Do not enable the bridge, issue production aliases, approve UID links, migrate real Customer Auth users, remove 2Factor, merge or publish OTA/APK/AAB from this PR. Signed-device verification, operator authorization review, full production backup/restore ability, and security review are separate hard gates.
