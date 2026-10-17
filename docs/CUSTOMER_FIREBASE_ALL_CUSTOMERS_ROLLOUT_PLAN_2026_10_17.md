# INSUREIT Customer Firebase OTP — all-Customer rollout plan
**17 October 2026 | IMPLEMENTATION IN PROGRESS | separate branch | no production rollout approval**

## 1. Decision and objective
Replace per-account canary provisioning with **one reusable Customer-only enrollment and sign-in process**, for existing and future Customer users. Firebase Android Phone Auth verifies possession of an Indian mobile number; the existing Supabase Auth identity is still the canonical, refreshable authentication principal. Do not let Firebase sign-in create a replacement Supabase Auth user, bypass RLS, or access Customer data using a Firebase JWT. Keep staff authentication and 2Factor fallback working.

The first owner-authorized live Customer ending **1634** signed in successfully after Android-only Expo OTA; Supabase recorded the bridge 200, Auth /verify 200, login under the **original Customer UUID**, and authenticated Customer-profile GET 200. Owner verified the login persisted on app restart. This proves the initial canary, **not** expiry-based token refresh, account separation or a general production-ready migration. Customer ending **1014** currently has no approved Firebase UID link and no Auth alias; its number is shared with an active IT Super User. Its latest 401 requires separate diagnosis; do NOT auto-link based on phone possession.

## 2. Production baseline — read-only, 2026-10-17
Connected Supabase project: `ilzhsfqqjyppzzvfscmh`. Query grouped Customer profiles, the matching Auth IDs, and existing link status. **Aggregate only, no customer names, UID values or phone lists exported.**

| Metric | Count |
| --- | ---: |
| Customer profiles, including inactive | 29 |
| Active Customer profiles | 23 |
| Customer profiles missing matching Auth record | 0 |
| Active Customers with an approved UID link AND confirmed Auth alias | 1 |
| Active Customers without an approved Firebase UID link | 21 |
| Active Customers without an Auth email identity | 22 |
| Active Customers sharing a phone with at least one non-Customer profile | 6 |
| Active Customers with unconfirmed original Supabase Auth phone | 2 |

Categories overlap. **Do not sum categories to estimate migration work.** Counts can change and are not approval to migrate users. Original Customer 1634 was the one confirmed end-to-end canary. Current production Edge Function `customer-firebase-session-bridge` **v7** is limited to two exact Customer UUIDs. Feature PR #3132 and diagnostic PR #3199 are unmerged; the isolated OTA to channel `firebase-internal`, runtime `0.3.2`, did not affect production channel.

## 3. Non-negotiable invariants
1. **Identity:** `profiles.id = auth.users.id = session.user.id` for the same original Customer. Preserve customers, policies, vehicles, claims, memberships, KYC, documents, RLS and Storage ownership. Do not create a new Auth UUID to work around login.
2. **Firebase:** Firebase Admin verifies signed ID token, expiry, revocation, project, issuer, SMS phone provider and recent `auth_time`; never use the JWT as a Supabase data-session credential. Require one-use exchange, rate limits and never log OTP, raw JWT, hashed challenge, Firebase UID or private keys.
3. **Eligibility:** Only active canonical Customer profiles. Staff, IT Super Users and partners cannot be selected by a phone number. Do not auto-enroll on OTP possession alone; existing data requires independent ownership evidence and consent.
4. **Immutable mapping:** One Firebase UID maps to one exact Customer UUID in `insureit-customer-auth`. Never silently rebind a UID or migrate it between users. Conflicts fail closed and need operator review.
5. **Shared phone:** If one mobile belongs to Customer and staff or more than one Customer, require independent Customer account proof and audited operator review. A Customer-app context is not by itself account ownership proof. Preserve staff account access.
6. **Auth email/credential recovery:** A deterministic reserved `.invalid` alias must never replace real user email, act as a customer contact address, or be created without recoverable encrypted Auth backup, independently tested restoration, approved credential rotation and recovery-risk review. Existing phone-confirmed state must remain unchanged.
7. **No rollout from a test:** Feature flags and explicit audited cohorts, safe fallback, reversible changes, observability and sign-off gates. No production migration, mass alias writes, UID approval, feature-flag opening, PR merge, OTA/APK/AAB or removal of 2Factor without later owner approval.

## 4. General enrollment and login architecture
```text
Android Firebase SMS OTP verified on-device
 -> Firebase Admin verifies ID token + auth_time + revocation
 -> Find canonical existing Customer by both profile AND Auth phone
 -> Check role, active status, uniqueness, banned/anonymous status
 -> Check staff/Customer phone collisions, previous UID mappings
 -> Existing approved immutable UID link + safe Auth identity?
      YES -> issue one-use Supabase magic-link hash for EXACT existing UUID
             -> Android verifyOtp -> getUser -> active Customer profile -> RLS
      NO  -> collect independent account ownership proof + consent
             -> suspicious/shared phone, UID collisions => operator review
             -> audited atomic UID approval for verified Customer only
             -> protected Auth alias recovery/migration gate
             -> enable this Customer's approved cohort only after tests
 -> Customer session remains original UUID, with prior-session rollback
```
New Customer signup is a **separate** explicit consent/profile workflow. Do not silently create an existing Customer or a new Auth record when an unmatched Firebase phone appears. Support an account-recovery path for recycled numbers.

## 5. Implementation phases and checks
### Phase A — implement now, **safe and source-only**
- Read-only production aggregate audit with no PII export. Put snapshot and overlap warning here.
- Build a deterministic, pure batch migration classifier for all existing Customers. Identify: ready linked identity, missing Firebase UID approval, missing Auth alias, shared staff/Customer phone, duplicate/conflict, inactive/absent Auth, real pre-existing Auth email, and alias recovery requirements. Expose only anonymous counts in summary.
- Build an **unwired default-deny** policy for future approved-Customer cohorts. Never replace the live two-UUID gate yet.
- Test staff collisions, mismatched Auth UUID/phone, unapproved/conflicting links, missing recovery, no public-client-asserted approvals, and preservation of previously approved same-UUID sessions.
- Open a reversible draft PR stacked on #3199. CI must pass. **No production writes or deployment in Phase A.**

### Phase B — controlled server-side enrollment (separate review)
- Design independently verified Customer evidence, consent and trusted IT Super User authorization. Obtain signed/revocation-checked Firebase identity, then use approved server-owned evidence—not client booleans—to drive enrollment.
- Review prepared migrations `20261016150000_customer_firebase_migration_audit.sql` and `20261016162000_customer_firebase_enrollment_atomic.sql`, correct concurrency/audit/rollback conditions, validate in disposable local DB. They remain **NOT APPLIED** to production.
- Service-only atomic UID mapping and immutable audit. Include idempotent re-review, conflict denial, staff separation and an operator-visible exception queue without exposing tokens.
- Perform genuine encrypted Auth backup and **restoration rehearsal** with approved environment. Previous local strong-hash restoration attempt failed (auth schema access), so this gate remains blocked. No bulk Auth alias mutation until it passes.

### Phase C — cohort-gated live testing (requires authorization)
- Under explicit approval, select a handful of non-shared Customers with independently established ownership plus at least one reviewed shared-phone Customer; preserve original UUIDs and counts.
- Introduce server-configured rollout cohorts backed by restricted approval/audit records, with emergency kill switch and rollback; **default remains existing two-UUID canary** until approved.
- Verify one-use exchange, replay/throttle, fresh OTP, active/disabled Customer, wrong UID, shared staff, revoked token, session refresh after token expiry, account switching A↔B, Customer-specific RLS/Storage and claim/policy/vehicle access.
- Perform staged rollout (e.g. 5% / 25% / remaining), observe errors and rollback triggers. Phased percentages are proposed gates, not scheduled actions.

### Phase D — final production release (separate approval)
- Approve native app/runtime channel compatibility and targeted OTA/AAB only where needed. Preserve all existing Customer and Partner functionality.
- Enable new Customer signups and recovery under the audited architecture; retire 2Factor only after all existing eligible Customers are migrated and fallback success is proven.

## 6. Stop conditions
Stop and require security review when no trustworthy Auth backup/recovery, any Customer/staff phone ambiguity lacks independent proof, UID conflicts or recycled phone indicators appear, immutable UUID/session/RLS mismatch occurs, a customer has a real Auth email requiring migration, the Firebase token cannot be verified or has stale auth_time, token replay succeeds, or Auth link provisioning fails. Never remediate by disabling RLS or changing staff accounts.

## 7. Agent continuation
Read `AGENTS.md`, `docs/CUSTOMER_FIREBASE_SESSION_HANDOFF_2026_10_16.md`, this plan, PR #3199 and #3132. Source branch for Phase A: `feat/customer-firebase-general-rollout-preflight-20261017`. Follow `docs/CUSTOMER_FIREBASE_BACKUP_RECOVERY_PLAN_2026_10_16.md` for the actual production recovery blocker. Review CI status on the exact latest SHA before any next action. Do not apply migrations/deploy a function or publish a mobile OTA during Phase A.

## Phase B implementation update — 2026-10-17 (source-only; NO live migration)
- New branch `feat/customer-firebase-reviewed-enrollment-phase-b-20261017` stacked on Phase A PR #3211. No live Supabase Edge Function, mobile login, account or database is changed.
- Added `supabase/functions/_shared/customer-firebase-reviewed-enrollment.mjs`: read-only server-side reviewer resolver. It verifies a genuine Supabase Auth operator session and active IT Super User role, uses Firebase Admin `verifyIdToken(...,true)` and <=300s phone auth_time, demands an exact existing active Customer/Auth UUID and matching phone in BOTH systems, and requires a service-only DB phone-collision result. It never selects a user solely from a shared phone.
- Resolver demands the **newest** restricted append-only review decision for this Customer matches a SHA-256 digest of verified Firebase UID, consent, independent ownership proof, authenticated reviewer and short expiry. A revocation or a different UID supersedes old approval. Shared numbers require a second independently active IT Super User reviewer. A real Auth email is never overwritten; missing alias is returned as pending, not written. No JWT, OTP, UID, phone or Auth password is included in the review record.
- Prepared (NOT APPLIED) migration `supabase/migrations/20261017120000_customer_firebase_operator_review_and_collisions.sql` defines a restricted append-only operator journal, service-role-only phone-collision RPC, immutable history trigger, active IT reviewer and dual-review insert guard, 14-day maximum approval validity. Data-preserving rollback is `supabase/rollback/20261017120000_customer_firebase_operator_review_and_collisions_down.sql`. It freezes the journal and removes the RPC, never deletes reviews or Customers.
- Added disposable PostgreSQL 17 integration rehearsal `apps/mobile-app/scripts/customer-firebase-reviewed-enrollment-sql-local.sh` and synthetic no-write policy tests `apps/mobile-app/scripts/customer-firebase-reviewed-enrollment.test.mjs`, driven by a dedicated GitHub Actions workflow. Initial CI identified an invalid test row-ID assumption and out-of-order synthetic approval timestamps, corrected in later commits. Recheck final CI at exact source HEAD.
- IMPORTANT: this is an **unwired review/preflight foundation**, NOT a production enrollment API or proof that stored review flags cannot be forged by a privileged service. The next implementation requires a trusted operator endpoint with Auth-verified operator and independent protected evidence, no public review insertion, proof revocation and an independently rehearsed encrypted Auth restore before any credential rotation.
- Still blocked: production backup and full Auth hash restoration (earlier disposable GoTrue rehearsal FAILED), per-Customer ownership attestation implementation, rollout-cohort activation, RLS/Storage A/B isolation, true post-expiry refresh and all-Customer approval. Do not run migration, enroll UID, provision Auth alias, change live feature flags, deploy Edge, merge, publish OTA or build APK/AAB.

### Phase B verification and PR
- Phase B draft PR: https://github.com/Frontier-Group-IT/insureit_new/pull/3212 (base = Phase A branch, not main).
- Dedicated synthetic reviewer and disposable PostgreSQL 17 workflow **PASS** on draft PR head `cb17b851` (run `39008831154`), following fixes to synthetic row-ID selection and timestamp ordering. Passed Node tests include verified operator, fresh Firebase auth, exact UUID/phone, revoked/expired review, shared phone second reviewer and no-write fallback; passed SQL tests include insert restrictions, immutable review history, anon RPC denial and data-preserving rollback.
- Broader mobile and web CI were still running on that commit when this record was written; check exact latest head rather than treating them as passed.

## Phase B2/C0 continuation — 2026-10-17 (source-only; no production deployment)
- Branch `feat/customer-firebase-auth-recovery-and-cohorts-20261017`, stacked on draft Phase B PR #3212. Owner asked to continue protected Auth recovery proof, audited enrollment and staged cohort preparation. Production Edge bridge must remain v7 and current two exact canaries.
- Added prepared, **UNAPPLIED** `supabase/migrations/20261017150000_customer_firebase_rollout_controls.sql`: a singleton rollout control starts `enabled=false`, `paused=true`. The service role may READ it but cannot directly modify it. No migration/feature activation was performed against production.
- Added server-only, **UNWIRED** `supabase/functions/_shared/customer-firebase-cohort-resolution.mjs`: code-owned default canary; for a future cohort, require enabled/unpaused protected DB control, newest unexpired approved reviewer decision matching the signed Firebase UID digest and original Customer UUID, confirmed Auth alias/link, reviewer active, and second independent active IT reviewer when any staff or other Customer shares the phone. Errors and revocation fail closed; phone possession or a client-supplied flag never grants access.
- Added prepared, **UNAPPLIED** `supabase/migrations/20261017160000_customer_firebase_enroll_reviewed_rpc.sql`: SQL verifies exact original active Customer Auth UUID/phone, pre-existing confirmed non-deliverable Auth alias, service role, newest short-lived independent operator review with UID digest, recovery evidence, immutable link compatibility, second reviewer for shared phones, and transactional advisory locks; delegates to the previously prepared atomic same-UUID link/audit RPC. It revokes the older direct service_role execute privilege. Its data-preserving rollback drops only the new function and does NOT restore older broad access.
- Added **UNWIRED** `supabase/functions/_shared/customer-firebase-reviewed-execution.mjs`: default dry-run denial; for future explicitly approved operator execution, rechecks the real Supabase staff session and Firebase Admin revocation-checked token, reads latest audit evidence server-side, and calls the reviewed SQL RPC. Missing Auth alias or recovery blocks execution. No direct Auth writes or new users.
- Added synthetic Node policy tests and disposable PostgreSQL 17 SQL tests for: default-disabled cohort, staff shared-phone second approval, mismatched/revoked UID, reviewer expiry and inactivity, same-UUID atomic link idempotency, newest revocation override and data-preserving rollback. GitHub Actions isolated cohort test run #39009871114 PASS on commit cdf45944 (before documentation-only commits). This is NOT an actual production token migration.
- Protected Auth restoration is a SEPARATE safety gate. Recovery workflow has been revised to grant temporary database permissions only inside the disposable GoTrue Docker container after asserting loopback URL. Do NOT call it proven until a completed green recovery run explicitly verifies prior real encrypted hash, original password login, same UUID and identities; synthetic proof does NOT mean a production encrypted backup exists.
- Remaining production gate: operator-controlled encrypted Auth backup outside GitHub and full restore rehearsal with matching Supabase GoTrue schema, independent Customer identity evidence and consent, security review of the service-only operator API, per-Customer RLS/Storage isolation, refreshed sessions after expiry, and a later explicit staged rollout approval. No production DDL, Auth changes, OTP provider retirement, APK/AAB/OTA, merge or deployment in this phase.
