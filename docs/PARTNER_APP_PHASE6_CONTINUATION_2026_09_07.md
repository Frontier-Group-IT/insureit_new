# INSUREIT Partner — Phase 6 continuation handoff

> Date: 2026-09-07 IST
> Scope: post-foundation Phase 6 native-ready implementation
> Status: SELECTIVE PRIVACY MERGED / PUSH DEVICE REGISTRATION IN REVIEW / NO 0.2.0 APK OR OTA

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

## Phase 6 foundation checkpoint

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

No OTA or native build was triggered by this merge.

## Secure push-device registration — current review slice

Branch:

`partner/phase6-push-device-registration`

Purpose: prepare authenticated Expo push-device registration without exposing any push-device table directly to Partner mobile clients.

### Database migration prepared — NOT APPLIED

Migration:

`supabase/migrations/20260907002000_partner_push_devices.sql`

It creates `partner_push_devices` with:

- unique Expo push token;
- Android/iOS platform;
- exact actor kind + actor ID;
- intermediary ID only for intermediary actors;
- EAS project ID and app version;
- active lifecycle + last-seen timestamps;
- RLS enabled;
- all direct privileges revoked from `anon` and `authenticated`;
- table access granted only to `service_role`.

**This migration is committed for review only. It has NOT been applied to production Supabase. Production migration application still requires separate explicit approval.**

### Authenticated API boundary

Route:

`apps/web-portal/app/api/partner/push-devices/route.ts`

The route mirrors the established Partner API security pattern:

1. accept bearer token or authenticated same-origin session;
2. validate the Supabase user;
3. resolve `partner_app_current_identity()`;
4. resolve `partner_app_commercial_scope()`;
5. only then use the server-side admin client.

Registration is restricted to:

- EAS project `8ade82c1-4c96-4f09-b90b-802270fb406d`;
- app version `0.2.0`;
- Android/iOS;
- valid Expo push-token shape.

A token upsert rebinds the token to the currently authenticated Partner actor, preventing stale prior-account ownership on a reused device. Unregister only deactivates a token when it belongs to the current resolved actor.

### Mobile lifecycle

`apps/partner-app/lib/partner-notifications.ts`

- notification permission remains user-triggered only;
- startup never calls the permission request;
- after the user grants permission, Settings registers the device through `/api/partner/push-devices`;
- on later authenticated startups, registration refreshes only if permission is already granted;
- the mobile app never reads/writes `partner_push_devices` directly;
- registration validates the exact Partner EAS project and 0.2.0 app identity;
- sign-out best-effort deactivates the current device before Supabase sign-out, with a short timeout so notification cleanup cannot trap the user in the app.

### Regression coverage

- `apps/web-portal/scripts/partner-push-device-registration-regression.mjs` protects the server-auth/table-access boundary.
- `.github/workflows/verify-web-portal.yml` runs that regression.
- `apps/partner-app/scripts/verify-phase6-native-foundation.mjs` protects permission timing, project/runtime identity, server-mediated token registration, authenticated-start refresh and pre-sign-out deactivation.

### Explicitly not implemented yet

This slice does **not** make production push notifications operational by itself. Still missing:

- production application of the push-device migration;
- EAS/platform push credentials validation;
- server-side event-to-notification sender pipeline;
- notification delivery retry/receipt cleanup policy;
- installed 0.2.0 device testing;
- official Android monochrome notification small icon.

Do not claim production push is live until those pieces are completed and verified.

## Remaining Phase 6 sequence

1. Get the push-device PR green and merge the code only.
2. Obtain explicit approval before applying `20260907002000_partner_push_devices.sql` to production.
3. Design the notification sender/event pipeline for authorized Renewal, Claim and Policy Intake events; keep message content minimal and scope-safe.
4. Prepare/review the official monochrome Android notification icon from official INSUREIT artwork; do not invent a replacement mark.
5. Wire the native date picker only into genuine Partner date inputs/filters.
6. Review restrained haptic placement; no noisy/global haptics.
7. Keep Sentry out unless project/DSN/source-map upload secret and privacy/redaction policy are actually ready.
8. Run final source/native-config checks.
9. Ask for explicit approval for the exact 0.2.0 preview APK build.
10. Build one preview APK and complete the installed-device Phase 6 matrix.
11. Only after the 0.2.0 binary is installed and accepted, publish a small 0.2.0 preview OTA to prove runtime-compatible OTA delivery.

## Non-negotiable safety reminders

- Never build Partner APK/AAB without explicit approval for that exact build.
- Never apply a Supabase migration to production merely because the migration file was merged.
- Never reuse Customer app EAS identity/update project for Partner.
- Never automatically prompt for notification permission on startup.
- Never give Partner mobile direct table access to the push-device registry.
- Never globally block screenshots; keep privacy route-scoped.
- Preserve historical vehicle-selector, claim-number-popup, session refresh and OTA compatibility regressions.
