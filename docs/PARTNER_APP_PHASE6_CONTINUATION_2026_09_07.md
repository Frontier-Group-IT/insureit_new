# INSUREIT Partner — Phase 6 continuation handoff

> Date: 2026-09-07 IST
> Scope: post-foundation Phase 6 native-ready implementation
> Status: PUSH CONTRACT + RECIPIENT AUDIT + BUSINESS RANGE MERGED / PUSH MIGRATION NOT PRODUCTION-APPLIED / NO 0.2.0 APK OR OTA

Read with:

- `AGENTS.md`
- `docs/PARTNER_APP_PRODUCTION_REFINEMENT_MASTER_PLAN.md`
- `docs/PARTNER_APP_PHASE6_NATIVE_BUILD_REVIEW_2026_09_06.md`
- `docs/PARTNER_APP_VISUAL_COMPLETION_HANDOFF_2026_09_05.md`
- `docs/PARTNER_APP_PHASE6_PUSH_RECIPIENT_SCOPE_AUDIT_2026_09_07.md`

## State vocabulary — keep these separate

- **PREPARED / IMPLEMENTED** — code or documentation exists in source.
- **MERGED** — change is in `main`; this does not mean production configuration/schema was applied.
- **PRODUCTION-APPLIED** — migration/configuration is confirmed in the production target.
- **OPERATIONAL** — the complete user-facing/provider flow is confirmed working in the intended installed app/environment.

Do not collapse these states in future updates.

## Locked native/runtime boundary

Partner source is on the approved Phase 6 identity:

- app version/runtime: `0.2.0`
- Android versionCode: `2`
- iOS buildNumber: `2`
- package/bundle: `com.insureit.partner`
- EAS project: `8ade82c1-4c96-4f09-b90b-802270fb406d`
- runtime policy: `appVersion`
- preview channel: `preview`

The existing installed 0.1.0 preview remains on runtime 0.1.0. No 0.2.0 OTA has been published and no 0.2.0 APK/AAB has been built.

The Partner preview APK workflow is manual-only and requires exact input `BUILD_PARTNER_0_2_0`. It also blocks until `apps/partner-app/assets/notification-icon.png` exists. Do not dispatch it without explicit user approval for that exact build.

## Phase 6 foundation — MERGED, not operational on a 0.2.0 installed binary

PR #1383 — `Prepare Partner 0.2.0 Phase 6 native foundation`

- merge: `4b814396c3d0a23f8f2391c9be9a2de49df06eeb`
- Partner Verify #204 — success
- Customer mobile Verify #664 — success
- Web Verify #3078 — success
- merged native dependencies: date picker, NetInfo, notifications, local authentication, screen capture and haptics
- no APK/AAB and no 0.2.0 OTA

## Selective privacy — MERGED, not installed-device verified on 0.2.0

PR #1386 — `Apply selective Partner screen privacy`

- final head: `89c64161edbdd9a6e5fbc787d12d98454a7a8b03`
- merge: `4830ddcf7b9396e9e45415195de5fd3617dc2bd3`
- Partner Verify #205 — success
- Web Verify #3081 — success

Protected route patterns only:

- `/customer/[id]`
- `/claim/[id]`
- `/policy-intake-new`
- `/policy-intakes/[id]`

Ordinary Partner routes remain screenshot-capable. Protection is centralized in `providers/partner-sensitive-privacy-provider.tsx`; the Phase 6 regression fails if global/root-level screenshot blocking or unapproved route expansion is introduced.

## Secure push-device registration — MERGED, production migration NOT APPLIED

PR #1388 — `Add secure Partner push device registration`

- final head: `6659f97b6ffad6a7d87c5d852352accedbb0236b`
- merge: `9ca581b5138b276b72564faca86dc7180a1b985f`
- Partner Verify #206 — success
- Web Verify #3083 — success

Migration:

`supabase/migrations/20260907002000_partner_push_devices.sql`

It creates a server-mediated `partner_push_devices` registry with unique Expo token, Android/iOS platform, actor ownership, optional intermediary ownership, EAS project/app identity, active lifecycle and timestamps. RLS is enabled; direct privileges are revoked from `anon` and `authenticated`; only `service_role` receives table access.

**The migration file is MERGED but has NOT been PRODUCTION-APPLIED. Explicit user approval is still required before applying it to production Supabase.**

Authenticated API:

`apps/web-portal/app/api/partner/push-devices/route.ts`

The route validates the user, resolves `partner_app_current_identity()` and `partner_app_commercial_scope()`, then uses the server-side admin client. Registration is restricted to Partner EAS project `8ade82c1-4c96-4f09-b90b-802270fb406d`, app version `0.2.0`, Android/iOS and valid Expo push-token shape. Mobile does not access `partner_push_devices` directly.

This does **not** make production push operational. Push credentials, production migration application, sender/event pipeline, receipts/retries, installed-device testing and the official Android monochrome small icon are still missing.

## Safe notification template contract — MERGED, deliberately non-active

PR #1390 — `Add safe Partner push notification templates`

- merge: `b1badf8444dc451663d8fb701b129fa57ee52caa`
- pure template layer only
- no recipient lookup
- no `partner_push_devices` query
- no Expo/APNs/FCM call
- no credentials, queue, cron or sender activation

File:

`apps/web-portal/lib/partner-push-notification-templates.ts`

Approved initial event vocabulary:

- `renewal_due`
- `claim_update`
- `intake_attention`
- `intake_approved`
- `intake_rejected`

Privacy/minimization rules remain:

- generic copy with no customer name, mobile number, policy number, claim number, vehicle registration or other business identifiers;
- destinations are scope-checked list surfaces (`/renewals`, `/(tabs)/claims`, `/policy-intakes`);
- notification channel is `partner-updates`;
- unknown event types fail closed.

## Push recipient-scope audit — MERGED, design only

PR #1396 — `Audit Partner Phase 6 push recipient scope`

- feature head: `78d99e6ae95982c5b9c130578b6fe764aae7cb02`
- merge: `dd1d77ed6cdfb81f4faefc52eab5a403c4604508`
- documentation/design only; no active delivery

Durable audit:

`docs/PARTNER_APP_PHASE6_PUSH_RECIPIENT_SCOPE_AUDIT_2026_09_07.md`

Recipient rule:

1. resolve business authorization for the event from the same canonical Partner relationships used by the existing scoped read contracts;
2. only then intersect those authorized actor IDs with active registered devices.

A device row is a delivery endpoint only and never creates business authorization. Missing/out-of-scope/unknown events must resolve to zero recipients. No sender may be activated until this boundary is preserved in server-only code and regression coverage.

## Business custom range — MERGED in source, not operational on installed 0.2.0 binary yet

PR #1397 — `Add Partner Business custom-range summary`

- verified head: `d47b589aaa7cac55ad2deab7970f301257015805`
- merge: `be27b62e2e1fa0f812bd6bf0ea2047201a55ad34`
- Partner Verify #207 — success
- Web Verify #3093 — success

Implementation:

- `apps/partner-app/components/partner-business-range-summary.tsx`
- `apps/partner-app/app/(tabs)/business.tsx`
- existing helper `getPartnerBusinessRange(fromDate, toDate)` remains in `apps/partner-app/lib/home.ts`
- existing backend remains `partner_app_business_range(p_from_date, p_to_date)`

Behavior:

- native From / To date pickers;
- dates remain ordered;
- range is capped at the existing 366-day safety limit;
- explicit Apply action;
- compact result contains only Premium / Policies / Customers / Claims;
- six-month Business trend semantics remain unchanged;
- current-month Business mix semantics remain unchanged;
- payout/network/renewal/claim sections remain unchanged.

No schema, RLS, migration, native dependency/config/runtime, APK/AAB or OTA change was introduced by #1397. Because the native date picker belongs to the 0.2.0 native foundation and no 0.2.0 binary has been built/installed, this source feature is **MERGED but not yet installed-device OPERATIONAL**.

## Remaining Phase 6 sequence

Completed safely in source:

1. pure push-template contract — MERGED (#1390), deliberately non-active;
2. recipient/domain scope audit — MERGED (#1396), design only;
3. Business custom-range wiring — MERGED (#1397), CI green, installed-device verification deferred to approved 0.2.0 build.

Still gated / next:

1. **Do not apply** `20260907002000_partner_push_devices.sql` until explicit production-migration approval is given.
2. Implement a server-only, fail-closed recipient resolver with regression coverage, but keep Expo/APNs/FCM delivery inactive unless separately approved.
3. Validate EAS/platform push credentials and define receipt/retry/stale-token cleanup before production delivery; never record credentials in repo docs.
4. Prepare/review the official monochrome Android notification icon from official INSUREIT artwork; do not invent a replacement mark.
5. Review restrained haptic placement; no noisy/global haptics.
6. Keep Sentry out unless project/DSN/source-map upload secret and privacy/redaction policy are actually ready.
7. Run final source/native-config checks.
8. Ask for explicit approval for the exact 0.2.0 preview APK build.
9. Build one preview APK and complete the installed-device Phase 6 matrix.
10. Only after the 0.2.0 binary is installed and accepted, publish a small 0.2.0 preview OTA to prove runtime-compatible OTA delivery.

## Non-negotiable safety reminders

- Never build Partner APK/AAB without explicit approval for that exact build.
- Never apply a Supabase migration to production merely because the migration file was merged.
- Never call a merged push schema or sender **production-applied** or **operational** without direct evidence.
- Never reuse Customer app EAS identity/update project for Partner.
- Never automatically prompt for notification permission on startup.
- Never give Partner mobile direct table access to the push-device registry.
- Never globally block screenshots; keep privacy route-scoped.
- Never include business/customer identifiers in lock-screen notification copy unless a separately reviewed requirement explicitly calls for it.
- Preserve historical vehicle-selector, claim-number-popup, session refresh and OTA compatibility regressions.
