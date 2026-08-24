# INSUREIT Performance Remediation Plan — 2026-08-24

## Purpose

This is the repository-owned plan for fixing the 24 August 2026 performance audit without risking production data, authorization, accounting, onboarding, document, OCR, or policy workflows. It complements `docs/PERFORMANCE_OPTIMIZATION_HANDOFF.md`; the full audit evidence is retained in the Codex deliverable `INSUREIT_PERFORMANCE_AUDIT_FULL_2026-08-24.md`.

## Evidence baseline

**VERIFIED production revision at audit time:** `59ae5aedfe1ef669fb0869f345fc97c62c3b4fbd`, Vercel deployment `dpl_6RVaMzMxkqgE7HzryPrrZgb9tqG1`, `READY`, Function region `iad1`.

**VERIFIED data region:** Supabase project `ilzhsfqqjyppzzvfscmh` is healthy in `ap-northeast-2` (Seoul).

**VERIFIED public performance:** desktop login Lighthouse 100; mobile login 90 with LCP 2.86 s, CLS 0.129, and about 520 KB transferred. Warm public HTTP requests from India were usually 0.18–0.25 s.

**VERIFIED source/build profile:** 109 pages, about 103 KB shared first-load JS, 79 `force-dynamic` files, 67 `revalidate = 0` files, 146 client files, 80 Server Action files, and 20 explicit `prefetch={false}` uses.

**VERIFIED database profile:** the database is still small (approximately 582 customers, 617 vehicles, 609 policies, and 31 claims), but the Supabase performance advisor returned 400 findings: 90 uncovered foreign keys, 81 RLS init-plan warnings, 62 multiple-permissive-policy warnings, 164 unused-index notices, and 3 duplicate-index warnings.

## Root causes

1. **Cross-region request path:** India users reach Vercel Functions in Washington, D.C.; those Functions repeatedly call Supabase Auth/Database/Storage in Seoul.
2. **Round-trip multiplication:** protected pages commonly perform serial auth, profile, capability, scope, query, and storage-signing stages.
3. **Dynamic route saturation:** nearly all authenticated pages render dynamically with no useful short-lived data cache.
4. **Navigation waits until click:** broad `prefetch={false}` usage prevents common destinations from warming.
5. **Unbounded registers:** major registers load the full accessible dataset and nested joins/counts instead of server pagination.
6. **Upload double-hop:** many uploads are fully buffered in the Vercel Function before being uploaded to Supabase Storage; multiple documents may be sequential.
7. **Large export construction:** CSV/XLSX can be built completely in Function memory instead of streamed/queued.
8. **Global client/hydration work:** root layout mounts workflow-specific client bridges and CSS globally.
9. **Hard reloads:** several workflows use `window.location.href`/`assign`, forcing full document reload and hydration.
10. **Observability gap:** no field Core Web Vitals/INP data or structured action-phase durations existed at audit time.

## Safety rules

- Never combine a performance change with business-rule, permission, RLS, schema, migration, workflow-state, accounting, or document-lifecycle changes.
- Never apply an index or RLS rewrite from an advisor count alone. Capture the exact query, run `EXPLAIN (ANALYZE, BUFFERS)` safely, write a reversible migration, and verify authorization for every affected role.
- Never switch Function or database regions directly in production. Use an exact-revision preview, an authenticated timing matrix, a rollback plan, and explicit user approval.
- Never replace a hard navigation until success/error/redirect semantics are covered by a focused regression.
- Never direct-upload files until file type/size validation, authorization, metadata finalization, orphan cleanup, retry, and malware/document controls are preserved.
- Never cache protected data without including the correct authorization/scope boundary and an invalidation rule.
- Performance telemetry must not contain tokens, cookies, PII, customer identifiers, policy/document numbers, storage paths, filenames, or form contents.
- Do not deploy these changes without the canonical feature-PR verification gate and explicit user instruction to deploy.

## Implementation status

### Implemented safely on `perf/safe-remediation-foundation`

- **IMPLEMENTED, not deployed:** Vercel Speed Insights is mounted in the root layout to collect field LCP, INP, CLS, FCP, and TTFB after deployment.
- **IMPLEMENTED, not deployed:** the 224 KB GitHub-hosted logo is replaced by a visually equivalent local 14.5 KB WebP. The external GitHub request and `unoptimized` bypass are removed.
- **IMPLEMENTED, not deployed:** common read-only navigation destinations prefetch on hover/focus. Create/edit/workflow routes remain opted out, preventing indiscriminate background execution.
- **IMPLEMENTED:** durable plan and agent safety guardrails are recorded; no production data, Supabase schema, RLS policy, storage object, region, environment, or workflow was changed.

### Deferred intentionally

- Function region experiment (`iad1` versus `icn1`).
- Supabase migration to `ap-south-1` and Vercel `bom1` evaluation.
- RLS policy and index changes.
- Dashboard RPC/read-model rewrite and caching.
- Server-side pagination for Customers, Policies, Vehicles, Claims, and Tasks.
- Direct/resumable upload redesign and asynchronous OCR.
- Streaming/queued exports.
- Root-layout client/CSS splitting.
- Hard-navigation replacement.

These items can deliver larger gains, but each needs authenticated tests and/or database/workflow regression evidence.

## Staged fix plan

### Phase 0 — Measurement and reversible delivery

1. Ship Speed Insights and the local logo through one feature PR.
2. Verify login, navigation, role visibility, logo appearance, and absence of new runtime errors in preview.
3. After explicit production deployment, collect at least seven days of route-level field data.
4. Record p50/p75/p95 for LCP, INP, CLS, and TTFB; add privacy-safe structured durations to the highest-value Server Actions.

**Gate:** no workflow, role, route, or visual regression; exact production deployment verified.

### Phase 1 — Region experiment

1. Create an exact-revision preview configured for Vercel `icn1`; do not modify production.
2. Run at least 30 authenticated samples for Login → Dashboard, Dashboard → Customers/Policies/Claims, a safe search/filter, document signing, and a synthetic non-persisted upload path if available.
3. Compare with `iad1` using the same account, client region, connection, dataset, and revision.
4. Change production region only with explicit approval, measured improvement, and immediate rollback instructions.

**Gate:** improved authenticated p75/p95 without new Auth, OCR, document, or Function errors.

### Phase 2 — Query-shape improvements

1. Convert one register at a time to server-side cursor pagination (25–50 rows), starting with Customers and Policies.
2. Preserve filters, search, sort, permission scope, totals, and export behavior with regressions.
3. Consolidate dashboard data into one scoped RPC/read model; keep the current path available for comparison/rollback.
4. Add short caching only where authorization scope and invalidation are explicit.

**Gate:** result parity for every authorized role and stable response size as row counts increase.

### Phase 3 — Database advisor remediation

1. Prioritize RLS init-plan warnings on high-frequency tables.
2. Wrap safe stable helpers such as `auth.uid()` in `select` only after confirming policy equivalence.
3. Consolidate overlapping permissive policies without changing effective access.
4. Add query-backed FK/composite/partial indexes; remove duplicate indexes.
5. Review “unused” indexes only after a representative usage window—never delete all 164 automatically.

**Gate:** security advisor remains clean, role-by-role access regressions pass, and EXPLAIN/`pg_stat_statements` proves the improvement.

### Phase 4 — Upload, OCR, download, and export

1. Introduce signed/resumable direct uploads behind a feature flag for one low-risk document workflow.
2. Preserve validation, authorization, metadata transaction, retry, cancellation, and orphan cleanup.
3. Acknowledge upload separately from asynchronous OCR completion.
4. Stream CSV; queue large XLSX generation; preserve the existing synchronous path as rollback until parity is proven.

**Gate:** 1/5/10/15 MB tests, multi-file tests, retry/failure cleanup, exact document visibility, and zero orphaned metadata/storage objects.

### Phase 5 — Client and navigation cleanup

1. Move route-specific root clients/CSS into route-group layouts one at a time.
2. Replace hard reloads only where focused tests cover success, validation failure, server failure, redirect, back button, and refresh behavior.
3. Split heavy policy/external forms by stage and measure bundle/INP changes.

**Gate:** complete workflow regressions and no stale UI after mutation.

## Acceptance targets

- Public mobile LCP p75 < 2.5 s and CLS < 0.1.
- Authenticated common navigation p75 ≤ 1.0 s when warmed and ≤ 1.8 s uncached.
- INP p75 < 200 ms.
- Simple Server Action p75 ≤ 1.0 s and p95 ≤ 2.5 s.
- Download initiation p75 ≤ 800 ms.
- Uploads show progress quickly, remain within documented size limits, and do not buffer whole files in the Function after direct upload is adopted.
- No performance release is accepted solely from public Lighthouse; authenticated field/synthetic evidence is required.

## Verification commands for the current low-risk patch

```text
npm run typecheck:web
npm run lint:web
npm run build:web
git diff --check
```

The canonical GitHub feature-PR verification workflow remains the release gate. A local green build is not deployment evidence.
