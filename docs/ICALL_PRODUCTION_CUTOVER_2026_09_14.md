# iCall POSP Production Cutover — 2026-09-14

## Evidence state

- Designated real POSP's previous iCall UAT snapshot in INSUREIT: **RESET / APPLIED / VERIFIED** in Supabase after an audit snapshot was written first.
- Production portal/gateway code in PR #1806: **IMPLEMENTED, NOT MERGED, NOT DEPLOYED**.
- Migration `20260914130000_icall_training_environment.sql`: **IMPLEMENTED, NOT APPLIED**.
- Lightsail runtime Production iCall credentials/routes: **NOT DEPLOYED / NOT VERIFIED**.
- iCall Production TCC: **BLOCKED** by provider-side Production `fpdf.php` dependency failure observed during direct canary testing.
- iCall iframe on `https://portal.insureit.in`: **UNVERIFIED / vendor-dependent**. Keep the fresh-SSO new-tab fallback; do not proxy around frame/CSP controls.

## Vendor clarification

iCall confirmed that the designated real POSP had previously been registered in UAT and therefore would not work with Production APIs while that UAT identity remained active. iCall subsequently confirmed that the UAT IDs were disabled and asked INSUREIT to retry the Production API.

After that cleanup, a direct Production status lookup returned `User not registered with given Login ID`, which is the expected pre-registration state. Do not manually register this canary through SSH. The first real Production registration should be initiated by the INSUREIT `Start Production Training` workflow after the cutover is deployed and verified.

Do not store the POSP PAN/login identifier or any iCall token in repository documentation.

## Target application flow

1. Operator reaches Training & Examination in INSUREIT.
2. `Start Production Training` calls INSUREIT server-side action.
3. Portal sends the sanitized registration request to the fixed-IP Lightsail gateway.
4. Gateway injects the iCall Production auth token and Base64-wraps the provider registration request.
5. INSUREIT persists the returned Production login ID before attempting status synchronization so a temporary status failure cannot cause duplicate provider registration.
6. INSUREIT calls Production `POSPTrainingStatus` and persists hours, dates, training state and exam state.
7. `Open training` creates a fresh Production SSO session server-side.
8. The browser receives only the short-lived SSO redirect URL; the iCall login identifier remains server-side/masked in UI.
9. Prefer embedded iframe when iCall framing/cookie policy allows it; retain `Open in new tab` using a fresh SSO URL as fallback.
10. `Sync latest status` refreshes authoritative training/exam progress from iCall.
11. Enable TCC only after iCall fixes/confirms the Production TCC route.

## Architecture

Canonical path remains:

`Browser -> INSUREIT Next.js server -> https://insureit.duckdns.org -> iCall Production`

Portal must never expose the gateway relay secret or the iCall Production auth token to client code.

PR #1806 adds explicit `/prod/icall/register`, `/prod/icall/status`, `/prod/icall/sso`, and `/prod/icall/tcc` gateway routes while retaining `/uat/icall/*` for controlled rollback/diagnostics.

## Schema isolation

PR #1806 adds `intermediary_training_exam_assignments.icall_environment` with allowed values `uat` or `production`.

- existing persisted iCall-linked snapshots are backfilled as `uat`;
- new Production registration writes `production`;
- Production SSO/status actions refuse to operate on a non-Production snapshot.

This prevents old UAT progress from being rendered or launched as if it were the real Production training journey.

## Applied canary reset

Before implementation, the designated canary application still contained an old UAT `In Progress` snapshot. A targeted Supabase transaction:

- wrote the pre-reset application/profile/assignment state to `audit_logs`;
- returned the application to `training_pending`;
- cleared active iCall login/progress/date/exam snapshot fields;
- set training to `not_assigned` and exam to `not_allotted`;
- preserved the actual POSP/application/document/onboarding identity.

A readback query directly verified the pending/reset state. This database reset is already applied; it is separate from the still-unapplied schema migration in PR #1806.

## Provider/document findings that remain relevant

The Production API document contains stale/mixed UAT examples. Direct testing established these operational rules:

- Registration uses the documented PROD endpoint and Base64 wrapper.
- Mobile must be normalized to a 10-digit Indian number for registration.
- The alternate token embedded in the document's Base64 example is not valid for the current Production Status/SSO path. Use only the privately configured current Production token.
- Production Status and SSO use plain JSON through the gateway.
- SSO URLs are short-lived/single-use: generate a fresh URL for each iframe/new-tab launch; never persist/reuse/log the tokenized URL.
- The inferred `/API/SANKALP/PROD/POSPTCC` handler exists but failed server-side because `fpdf.php` was missing. Do not mark TCC operational until iCall fixes and confirms it.

## Required runtime cutover after merge approval

The GitHub commit alone does not update Lightsail.

Before the portal may use Production iCall:

1. Apply the `icall_environment` migration through the protected schema workflow and verify it.
2. Put `ICALL_PROD_AUTH_TOKEN` into `/opt/insureit-gateway/.env` privately. Never put the token in GitHub, Vercel public vars, logs or chat handoff docs.
3. Set/confirm `ICALL_PROD_BASE_URL=https://www.icallinsurance.com/API/SANKALP/PROD`.
4. Update the running Lightsail gateway code to the exact merged commit.
5. Ensure Nginx proxies `/prod/icall/` to `127.0.0.1:3001`; the historical config only documented `/uat/icall/`.
6. Restart `insureit-gateway.service` and verify `/health` reports `icall_production: configured` without revealing credentials.
7. From the portal, use `Start Production Training` exactly once for the reset canary POSP.
8. Verify provider registration success, portal persistence, Production status synchronization, fresh SSO/new-tab launch, then iframe behavior separately.
9. Do not enable TCC completion flow until provider repair is verified.

## Rollback boundary

Do not delete UAT gateway routes during initial Production rollout. If Production cutover fails before a new provider registration is created, rollback the portal/gateway code without altering provider data. If Production registration succeeds, preserve the Production login/environment marker and diagnose status/SSO rather than attempting a second registration.
