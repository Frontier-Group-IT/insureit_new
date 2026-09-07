# INSUREIT Partner — Phase 6 push delivery readiness

> Date: 2026-09-07 IST
> Scope: design/readiness only
> Status: NOT OPERATIONAL / NO SENDER ACTIVATION / NO PRODUCTION MIGRATION APPLICATION / NO APK-AAB / NO OTA

Read with:

- `docs/PARTNER_APP_PHASE6_CONTINUATION_2026_09_07.md`
- `docs/PARTNER_APP_PHASE6_PUSH_RECIPIENT_SCOPE_AUDIT_2026_09_07.md`
- `apps/web-portal/lib/partner-push-recipient-resolver.ts`
- `apps/web-portal/lib/partner-push-notification-templates.ts`
- `apps/web-portal/app/api/partner/push-devices/route.ts`
- `supabase/migrations/20260907002000_partner_push_devices.sql`

## Purpose

This document defines the minimum server-side delivery lifecycle that must exist before INSUREIT Partner push can be described as operational. It does not activate Expo, APNs or FCM delivery and it does not apply the merged push-device migration.

The existing source boundaries remain authoritative:

1. business authorization is resolved before device lookup;
2. device registration is only a delivery endpoint and never grants business authorization;
3. notification copy stays generic and privacy-minimized;
4. unknown, missing, invalid and out-of-scope events fail closed;
5. Partner project/app identity remains EAS project `8ade82c1-4c96-4f09-b90b-802270fb406d`, app/runtime `0.2.0`.

## Current readiness evidence

### Confirmed in repository

- Partner push-device registration is server mediated.
- `partner_push_devices` is designed for service-role-only table access; direct `anon` / `authenticated` table access is revoked.
- Device lifecycle already contains `active`, `last_seen_at`, `created_at` and `updated_at`.
- Registration reactivates/upserts a matching Expo token and refreshes `last_seen_at`.
- Explicit unregister marks the matching actor-owned token inactive.
- The Partner preview build workflow references the dedicated `EXPO_TOKEN_PARTNER` secret and checks EAS project access before building.
- The Partner preview OTA workflow also references `EXPO_TOKEN_PARTNER` and verifies that Partner does not reuse Customer EAS/update identity.

### Not confirmed / still blocked

- Repository wiring does not prove that the `EXPO_TOKEN_PARTNER` secret currently exists or is valid; secret values/presence must not be copied into repo documentation.
- FCM/APNs push credential validity has not been demonstrated by an approved Partner 0.2.0 build or provider test.
- `apps/partner-app/assets/notification-icon.png` is absent; the native preview workflow deliberately blocks until the official monochrome INSUREIT notification icon exists.
- `20260907002000_partner_push_devices.sql` remains MERGED but NOT PRODUCTION-APPLIED.
- No sender, event trigger, delivery queue, ticket store, receipt worker, retry scheduler or stale-token cleanup worker is active.
- No 0.2.0 Partner APK/AAB exists and no 0.2.0 Partner OTA has been published.

## Required delivery state machine

A future sender must keep transport state separate from business authorization state.

Suggested transport states:

- `pending` — authorized event prepared for delivery but not yet submitted to Expo.
- `submitted` — Expo accepted the request and returned a ticket/receipt id. This is not proof of device delivery.
- `retry_wait` — transient transport/provider failure; eligible for bounded exponential-backoff retry.
- `provider_accepted` — receipt confirms FCM/APNs accepted the notification.
- `permanent_failure` — non-retryable payload/credential/provider error requiring operator or code/config action.
- `device_inactive` — token is no longer eligible and must not be targeted until the app registers it again.

Do not expose these transport states as customer/business workflow states.

## Required server delivery sequence

1. Receive an approved Partner push event type and canonical record id from a trusted server-side event source.
2. Re-resolve current business authorization using the fail-closed recipient resolver contract.
3. If zero authorized recipients remain, stop with no delivery attempt.
4. Build privacy-minimized notification copy using the approved template contract.
5. Submit only eligible Partner 0.2.0 Expo tokens, with bounded batching/rate control.
6. Persist the Expo ticket id and minimal transport metadata needed for receipt follow-up. Do not persist unnecessary business/customer PII in the transport record.
7. Treat an Expo `ok` ticket only as acceptance by Expo, never as proof that the device received the notification.
8. Fetch receipts after an appropriate delay. Expo currently recommends checking receipts around 15 minutes after sending and notes that receipts are cleared after 24 hours.
9. On receipt success, mark the transport attempt provider-accepted.
10. On `DeviceNotRegistered`, mark the corresponding `partner_push_devices` row inactive and stop targeting that token until a future app registration reactivates/replaces it.
11. Retry only transient failures with bounded exponential backoff and a hard attempt/age ceiling.
12. Record permanent credential/payload/configuration errors for operator attention without repeatedly hammering the provider.

## Retry policy boundary

Retryable examples:

- temporary network failure between the server and Expo;
- HTTP 429;
- HTTP 5xx;
- provider rate conditions such as message-rate exceeded when the provider guidance indicates retry/backoff.

Non-retryable examples until configuration/code changes:

- malformed/oversized payload;
- project/experience mismatch;
- invalid or missing push credentials;
- sender-id mismatch;
- token reported `DeviceNotRegistered`.

Recommended safety shape before implementation:

- exponential backoff with jitter;
- bounded attempts rather than infinite retry;
- maximum delivery age so stale operational events do not notify long after relevance;
- idempotency key per event + recipient token so worker replay cannot fan out duplicate messages accidentally;
- provider and network concurrency/rate caps;
- no synchronous request path should block business writes while waiting for push delivery.

Exact retry counts/timers should be selected when the concrete worker/queue platform is chosen; do not hard-code arbitrary production values in advance of that architecture decision.

## Stale-token lifecycle

The existing `active` flag is the authoritative eligibility switch.

A future receipt worker should:

1. map each ticket/receipt back to exactly one submitted Expo token;
2. when Expo reports `DeviceNotRegistered`, update only that token to `active = false` and refresh `updated_at`;
3. never delete the row merely to hide provider errors; retaining lifecycle metadata supports audit/debugging;
4. never deactivate another actor's token due to a mismatched receipt mapping;
5. allow authenticated mobile registration to reactivate/upsert a valid current token later;
6. continue filtering by current Partner EAS project/app identity during recipient resolution.

Optional later hygiene may mark very old `last_seen_at` endpoints inactive, but any age-based policy must be separately reviewed so it does not silently suppress valid devices.

## Credential readiness boundary

Before sender activation, independently verify:

- the dedicated Partner Expo account token can access the linked Partner EAS project;
- Android FCM v1 credentials are valid for `com.insureit.partner`;
- iOS APNs credentials are valid for `com.insureit.partner` before iOS push is enabled;
- no Customer app credentials/project identity are reused as Partner identity;
- credential checks happen through EAS/provider tooling without writing secret contents into source, PR comments or handoff docs.

A workflow reference such as `${{ secrets.EXPO_TOKEN_PARTNER }}` is configuration wiring only. It must not be reported as validated credentials until an allowed check actually succeeds.

## Android notification icon blocker

The official monochrome Android small-notification icon is still required at:

`apps/partner-app/assets/notification-icon.png`

Do not generate or substitute a random mark. The asset must be derived from approved official INSUREIT artwork and reviewed visually before it is wired into the `expo-notifications` plugin/native build configuration.

The existing Partner preview APK workflow intentionally blocks while this file is missing. Preserve that blocker until the approved asset exists.

## Event-trigger boundary

Do not activate database triggers, cron jobs or broad polling merely because templates and recipient resolution exist.

Each initial event needs a separately reviewed canonical trigger point:

- `renewal_due` — must be derived from the canonical renewal/policy source and should be idempotent per intended reminder window.
- `claim_update` — must be tied to a meaningful persisted claim-state change, not every claim row update.
- `intake_attention`, `intake_approved`, `intake_rejected` — must target only the exact current intake submitter/owner and fire only on meaningful persisted lifecycle transitions.

Event generation and delivery must be decoupled so a provider outage cannot roll back or block the underlying business transaction.

## Privacy and observability rules

Allowed delivery observability should focus on transport metadata such as:

- event type;
- opaque event/delivery id;
- platform;
- attempt number;
- transport status;
- provider error category;
- timestamps.

Do not place customer names, mobile numbers, policy numbers, claim numbers, vehicle registrations, notification body text or raw auth/session tokens into routine delivery logs.

Expo push tokens are delivery credentials/identifiers and should be redacted or hashed in ordinary logs rather than copied into broad telemetry.

## Activation gates

Push delivery remains NOT OPERATIONAL until all of these are satisfied:

1. explicit approval and production application of the push-device migration;
2. official Android notification icon prepared and configured for the approved native build;
3. Partner 0.2.0 APK/AAB explicitly approved, built and installed for device testing;
4. EAS + FCM/APNs credential checks completed for the intended platform(s);
5. concrete server adapters implement the authorization-first resolver without widening scope;
6. sender/queue implementation is reviewed with idempotency and bounded retry;
7. receipt polling/processing is implemented and tested;
8. `DeviceNotRegistered` deactivation is implemented and tested;
9. privacy-minimized logs/metrics exist without business PII;
10. controlled end-to-end test confirms event -> authorized recipient -> ticket -> receipt -> app behavior;
11. only after the installed 0.2.0 binary is accepted should a small runtime-compatible 0.2.0 preview OTA be published.

## Explicit non-actions in this slice

This document does not:

- apply any Supabase migration;
- create or activate a sender;
- call Expo/APNs/FCM;
- add provider credentials;
- create database triggers, queues, cron jobs or workers;
- create or alter a Partner APK/AAB;
- publish a Partner OTA;
- invent or generate the missing official notification icon.
