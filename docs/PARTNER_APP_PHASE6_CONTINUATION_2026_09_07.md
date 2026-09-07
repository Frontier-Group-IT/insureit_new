# INSUREIT Partner — Phase 6 continuation handoff

> Date: 2026-09-07 IST
> Scope: post-foundation Phase 6 native-ready implementation
> Status: SELECTIVE PRIVACY + PUSH REGISTRATION MERGED / SAFE PUSH TEMPLATE CONTRACT IN REVIEW / NO 0.2.0 APK OR OTA

Read with:

- `AGENTS.md`
- `docs/PARTNER_APP_PRODUCTION_REFINEMENT_MASTER_PLAN.md`
- `docs/PARTNER_APP_PHASE6_NATIVE_BUILD_REVIEW_2026_09_06.md`
- `docs/PARTNER_APP_VISUAL_COMPLETION_HANDOFF_2026_09_05.md`

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

## Phase 6 foundation — merged

PR #1383 — `Prepare Partner 0.2.0 Phase 6 native foundation`

- merge: `4b814396c3d0a23f8f2391c9be9a2de49df06eeb`
- Partner Verify #204 — success
- Customer mobile Verify #664 — success
- Web Verify #3078 — success
- merged native dependencies: date picker, NetInfo, notifications, local authentication, screen capture and haptics
- no APK/AAB and no 0.2.0 OTA

## Selective privacy — merged

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

## Secure push-device registration — merged, production migration NOT APPLIED

PR #1388 — `Add secure Partner push device registration`

- final head: `6659f97b6ffad6a7d87c5d852352accedbb0236b`
- merge: `9ca581b5138b276b72564faca86dc7180a1b985f`
- Partner Verify #206 — success
- Web Verify #3083 — success
- concurrent AuthBridge work on `main` was preserved

Migration:

`supabase/migrations/20260907002000_partner_push_devices.sql`

It creates a server-mediated `partner_push_devices` registry with unique Expo token, Android/iOS platform, actor ownership, optional intermediary ownership, EAS project/app identity, active lifecycle and timestamps. RLS is enabled; direct privileges are revoked from `anon` and `authenticated`; only `service_role` receives table access.

**The migration file is merged but has NOT been applied to production Supabase. Production application still requires separate explicit user approval.**

Authenticated API:

`apps/web-portal/app/api/partner/push-devices/route.ts`

The route validates the user, resolves `partner_app_current_identity()` and `partner_app_commercial_scope()`, then uses the server-side admin client. Registration is restricted to Partner EAS project `8ade82c1-4c96-4f09-b90b-802270fb406d`, app version `0.2.0`, Android/iOS and valid Expo push-token shape. A reused token is rebound to the currently authenticated actor. Unregister only deactivates a token belonging to that actor.

Mobile lifecycle:

- permission remains user-triggered from Settings;
- startup never requests permission;
- after permission is granted, Settings registers through `/api/partner/push-devices`;
- later authenticated startup refreshes registration only when permission is already granted;
- mobile never accesses `partner_push_devices` directly;
- sign-out best-effort deactivates the current device before Supabase logout with a bounded timeout.

This does **not** make production push live. Push credentials, production migration application, sender/event pipeline, receipts/retries, installed-device testing and the official Android monochrome small icon are still missing.

## Safe notification template/sender contract — current review slice

Branch:

`partner/phase6-push-sender-contract`

This slice is deliberately **pure/non-active**. It does not query recipients, query `partner_push_devices`, call Expo/APNs/FCM, use credentials, enqueue jobs or send notifications.

File:

`apps/web-portal/lib/partner-push-notification-templates.ts`

Approved initial event vocabulary:

- `renewal_due`
- `claim_update`
- `intake_attention`
- `intake_approved`
- `intake_rejected`

Privacy/minimization rules:

- notification copy is generic and contains no customer name, mobile number, policy number, claim number, vehicle registration or other business identifiers;
- routes intentionally land on scope-checked list surfaces (`/renewals`, `/(tabs)/claims`, `/policy-intakes`) instead of embedding record IDs in notification data;
- notification channel is `partner-updates`;
- unknown event types fail closed.

Regression:

`apps/web-portal/scripts/partner-push-template-regression.mjs`

It fails if the template layer gains active delivery calls, push-token/table references, server admin access, raw service-role usage or common PII identifier fields. `.github/workflows/verify-web-portal.yml` runs this contract.

Do not add recipient resolution or active delivery until the existing domain relationships are audited and production push activation is separately approved.

## Date picker discovery

There is a genuine scoped custom-range backend:

`partner_app_business_range(p_from_date date, p_to_date date)`

and mobile helper:

`getPartnerBusinessRange(fromDate, toDate)`.

The RPC has a 366-day safety limit. `PartnerDatePicker` already exists as a reusable native component.

Do **not** apply a custom range indiscriminately to the whole Business screen: the current six-month trend and current-month business-mix sections have different semantics. A safe future integration should expose a compact custom-range summary (Premium / Policies / Customers / Claims), while keeping existing trend/mix sections explicitly tied to their own periods.

## Remaining Phase 6 sequence

1. Get the pure push-template contract PR green and merge it; it must remain non-active.
2. Obtain explicit approval before applying `20260907002000_partner_push_devices.sql` to production.
3. Audit exact domain relationships and design recipient resolution for Renewal, Claim and Policy Intake events before any sender implementation.
4. Validate EAS/platform push credentials and define receipt/retry/token-cleanup behavior before production delivery.
5. Prepare/review the official monochrome Android notification icon from official INSUREIT artwork; do not invent a replacement mark.
6. Wire the native date picker into the genuine Business custom-range summary without changing existing trend/current-month semantics.
7. Review restrained haptic placement; no noisy/global haptics.
8. Keep Sentry out unless project/DSN/source-map upload secret and privacy/redaction policy are actually ready.
9. Run final source/native-config checks.
10. Ask for explicit approval for the exact 0.2.0 preview APK build.
11. Build one preview APK and complete the installed-device Phase 6 matrix.
12. Only after the 0.2.0 binary is installed and accepted, publish a small 0.2.0 preview OTA to prove runtime-compatible OTA delivery.

## Non-negotiable safety reminders

- Never build Partner APK/AAB without explicit approval for that exact build.
- Never apply a Supabase migration to production merely because the migration file was merged.
- Never reuse Customer app EAS identity/update project for Partner.
- Never automatically prompt for notification permission on startup.
- Never give Partner mobile direct table access to the push-device registry.
- Never globally block screenshots; keep privacy route-scoped.
- Never include business/customer identifiers in lock-screen notification copy unless a separately reviewed requirement explicitly calls for it.
- Preserve historical vehicle-selector, claim-number-popup, session refresh and OTA compatibility regressions.
