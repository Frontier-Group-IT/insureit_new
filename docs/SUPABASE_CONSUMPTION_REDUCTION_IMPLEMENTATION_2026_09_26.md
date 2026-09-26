# Supabase Consumption Reduction Implementation — 2026-09-26

Status: PHASE 1 IMPLEMENTED ON BRANCH — CI/merge/deployment/production measurement pending.

This file continues `docs/SUPABASE_LOG_INGESTION_INVESTIGATION_2026_09_25.md`.

## Objective

Reduce Supabase Log Ingestion caused by repeated authorization queries without weakening any authentication, RLS, role, employee override, Accounts, backoffice or IT Super User behavior.

## Phase 1 — Effective permission map consolidation

Branch: `perf/supabase-permission-map-consolidation`

### Problem confirmed by the forensic investigation

The billing-cycle investigation measured roughly:
- 141,815 requests to `employee_permission_overrides`
- 87,898 requests to `role_permission_overrides`
- about 19.1% of measured Supabase Edge-log payload from those two endpoint families alone

The previous `hasEffectiveCapability()` path resolved a single capability through `getEffectivePermission()`. A page asking several capability questions could therefore resolve employee and role overrides repeatedly.

`hasAnyEffectiveCapability()` was especially inefficient because it launched `hasEffectiveCapability()` independently for every candidate capability.

### Implementation

`apps/web-portal/lib/effective-permissions.ts` now uses the existing authoritative bulk loader:

`getEffectivePermissionAccessMapForRole(profileId, role)`

That loader is already React-cached by `(profileId, role)` and loads the active employee override set plus the role override set once for the applicable request/render cache boundary.

Changes:
1. `hasEffectiveCapability()` now reads the requested capability from the resolved effective-access map.
2. `hasAnyEffectiveCapability()` resolves the map once and evaluates all requested capabilities in memory instead of launching parallel capability-specific database lookups.
3. Accounts special-case behavior is preserved exactly, including the server-only `view_reports` allowance.
4. Required access-level comparison remains unchanged.
5. No cross-request/browser permission cache was introduced.
6. No database, migration, RLS, middleware, session or route behavior changed.

### Security semantics intentionally preserved

The bulk loader already applies the same access precedence used by effective permissions:
- IT Super User protected access
- employee override before role override
- role default fallback
- backoffice permission ceiling
- expired employee overrides excluded

This phase only consolidates reads used for access-level checks. It does not remove or bypass the authoritative permission tables.

### Expected effect

For server renders/routes that evaluate multiple capabilities for the same profile/role, permission-table traffic should collapse from multiple employee+role query pairs to one employee query plus one role query per applicable cache boundary.

Expected permission endpoint reduction: approximately 60–80% on multi-capability requests. Actual production reduction must be measured after deployment.

### Required verification before merge

- full `Verify web portal` workflow
- access-control v2 regressions
- scope/lifecycle/governance/security regressions included by the repository workflow
- typecheck/lint/build
- no middleware or RLS diff

### Required post-deploy measurement

Compare a like-for-like production window against the forensic baseline:
- `employee_permission_overrides` request count and log payload
- `role_permission_overrides` request count and log payload
- `profiles` and `/auth/v1/user` should remain unchanged in this phase
- authorization/403/redirect error rate

Do not proceed to middleware session/profile de-amplification until this phase is verified and its reduction is measured.
