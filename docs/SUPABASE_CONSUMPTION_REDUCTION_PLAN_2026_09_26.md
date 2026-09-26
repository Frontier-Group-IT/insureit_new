# Supabase Consumption Reduction Plan — 2026-09-26

This plan follows the evidence in `docs/SUPABASE_LOG_INGESTION_INVESTIGATION_2026_09_25.md`.

## Objective

Reduce Supabase Edge/API log ingestion by at least 50% without weakening authentication, authorization, RLS, customer/partner isolation, role/employee overrides, DNC safeguards, or business workflows.

Stretch target: 60–70% reduction on normal non-campaign days.

## Non-negotiable safeguards

- Do not revert the 17 Sep stale-role/session hardening without an equally strong replacement.
- Disabled users and role changes must continue to take effect promptly.
- IT Super User protected access, Accounts restrictions, Sales Executive restrictions and intermediary/customer scopes must remain intact.
- Do not bypass RLS or move sensitive authorization into long-lived browser-readable state.
- Do not remove employee or role permission overrides.
- Do not weaken voice DNC, terminal-status, calling-window, kill-switch or webhook idempotency safeguards.
- Do not log secrets, tokens, cookies, phone numbers, transcripts or customer payloads for performance measurement.
- Every production optimization must pass the canonical `Verify web portal` workflow before merge.

## Baseline findings

The forensic investigation measured the following approximate shares of billing-cycle Supabase Edge-log payload:

- `profiles`: 17.5%
- `employee_permission_overrides`: 12.3%
- `role_permission_overrides`: 6.8%
- `/auth/v1/user`: 3.4%
- auth/profile/permission combined: about 39.9%

On the campaign-heavy latest-day sample:

- auth + profile: about 28.4%
- voice campaign workflow: about 23.7%
- permission overrides: about 11.8%

## Staged implementation order

### Phase 1 — Permission-map consolidation

Status: implemented on `perf/supabase-permission-map-consolidation`; PR #2452; production measurement pending.

Goal:
- replace capability-by-capability employee/role override reads with one effective permission-map resolution per applicable request/render boundary.

Design:
- use existing `getEffectivePermissionAccessMapForRole(profileId, role)`.
- preserve employee override precedence, role override fallback, role defaults, backoffice ceiling and IT Super User protection.
- keep authoritative database resolution fresh on new request/render boundaries; no new cross-request browser permission cache.

Expected result:
- 60–80% fewer permission-table requests on routes that evaluate several capabilities.

Acceptance:
- access-control/security regressions pass.
- typecheck/lint/build pass.
- after deployment, compare `employee_permission_overrides` and `role_permission_overrides` counts/payload against a like-for-like production window.
- `/auth/v1/user` and `profiles` should not materially change from this phase alone.

### Phase 2 — Security-preserving middleware auth/profile de-amplification

Start only after Phase 1 is deployed and measured.

Current issue:
- each protected middleware execution performs `/auth/v1/user` and `/rest/v1/profiles` with no-store semantics.
- latest evidence showed near one-to-one middleware execution and auth/profile calls.

Preferred design for review:
- cryptographically validate the JWT on protected requests.
- use a short-lived server-signed authorization/routing snapshot containing only minimal profile/role/active-state information.
- database-backed profile revalidation on a tightly bounded interval, with forced immediate revalidation on login, refresh, account/role changes, sensitive admin paths, missing/invalid snapshot and explicit invalidation events.
- sensitive server mutations continue using authoritative effective-permission checks.
- never trust a plain client role cookie as authorization.

Initial design TTL for review: maximum 5 minutes for routine routing, not for sensitive mutation authorization.

Required security tests:
- role change
- user deactivation
- shared-browser account switch
- expired access token
- refresh token
- Accounts and Sales Executive redirects
- intermediary/customer scope isolation

Expected result:
- 80–95% reduction in repeated middleware Auth/Profile network calls during routine navigation, subject to security review.

### Phase 3 — Voice campaign attempt and query efficiency

Current issue:
- large campaigns produced a major latest-day spike.
- some opportunities received multiple local attempts; local and provider retry semantics are currently conflated.
- dispatch batch size of 3 causes many serverless/API cycles.

Plan:
1. Separate INSUREIT local attempt ordinal from provider retry count.
2. Introduce an explicit business-approved maximum local attempt policy.
   - proposed for review only: initial attempt + maximum 2 retries.
   - only approved retryable outcomes such as busy/no-answer.
   - never retry DNC, already-renewed, terminal or protected outcomes.
3. Increase dispatch batch size only after timing/provider-rate-limit validation; investigate a bounded 10–20 member batch.
4. Use aggregate queries for campaign KPIs instead of repeatedly loading whole member/attempt sets.
5. Paginate campaign member rows.
6. Use latest-attempt projection for list state; full history only for explicit detail/export.
7. Reuse invariant operational/campaign settings within one dispatch request.

Expected result:
- 40–70% lower Supabase traffic for large campaigns, depending on retry volume and safe batch size.

### Phase 4 — Claims background refresh

Current issue:
- claim detail uses Realtime and also polls sync-version every 2 seconds.

Plan:
- keep Realtime primary.
- fallback polling only when tab is visible and Realtime is stale/disconnected.
- use a substantially slower fallback interval, initially 30–60 seconds for validation.
- refresh immediately on reconnect/focus.

Expected result:
- greater than 90% reduction in idle claim-sync polling while retaining recovery behavior.

### Phase 5 — Customer App profile/context de-duplication

Inspect repeated mobile calls for:
- profiles
- accessible customer context
- vehicles
- policies/external policies
- insurer/reference masters

Plan:
- safely reuse stable identity/context/reference data.
- explicit invalidation on account switch/profile changes.
- preserve per-user/customer isolation.

### Phase 6 — Re-rank and optimize remaining page fan-out

After Phases 1–5, query fresh logs instead of optimizing based on the old ranking.

Likely candidates from the current investigation:
- intermediary onboarding detail/workflow
- dashboard
- policies
- reports
- voice campaign detail

For each route measure one cold request and identify duplicate profile, permission, master-data, count and nested component queries. Prefer aggregate RPCs/counts and pagination when full row payload is not needed.

## Rollout discipline

Keep each high-risk change independently reversible:

1. permission consolidation
2. middleware auth/profile redesign
3. voice retry semantics
4. voice campaign query/batching optimization
5. claim polling fallback
6. mobile de-duplication
7. page-specific fan-out fixes

Do not combine Phase 1 permission changes and Phase 2 middleware changes in one PR.

## Before/after evidence required for each deployed phase

Record:
- exact deployed commit and timestamp
- comparable pre/post Supabase Edge request count
- comparable pre/post log-payload proxy
- affected endpoint counts
- error/403/redirect behavior
- feature/security regressions run
- rollback reference

The optimization is successful only when production logs prove reduced consumption without authorization or workflow regression.
