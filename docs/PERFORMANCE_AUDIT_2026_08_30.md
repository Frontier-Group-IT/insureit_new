# INSUREIT Web Portal Performance Audit — 2026-08-30

## Purpose

This audit continues the earlier performance work documented in:

- `docs/performance-audit-2026-08-07.md`
- `docs/PERFORMANCE_OPTIMIZATION_HANDOFF.md`
- `docs/PERFORMANCE_REMEDIATION_PLAN_2026_08_24.md`
- `docs/PERFORMANCE_AUTHENTICATED_BASELINE_2026_08_24.md`

The objective is to improve real authenticated portal responsiveness without weakening authentication, authorization, RLS, business workflow rules, financial logic, OCR behavior, or auditability.

## Previous measured baseline

The 2026-08-24 authenticated India baseline recorded two-run means of:

| Route | Mean |
| --- | ---: |
| Dashboard | 3.263 s |
| Customers | 5.400 s |
| Vehicles | 5.767 s |
| Policies | 6.358 s |
| Claims | 5.210 s |
| Tasks | 1.429 s |
| Reports | 3.450 s |
| Accounts | 1.290 s |

This audit treats those numbers as directional historical evidence, not a current p75/p95 production benchmark.

## Current production topology

Verified on 2026-08-30:

- Vercel project: `insureit`
- Production domain: `https://portal.insureit.in`
- Production Vercel Function region: `iad1` (Washington, D.C.)
- Supabase project region: `ap-northeast-2` (Seoul)
- Primary users: India
- Production deployment inspected: `dpl_BSHqY2GCDfxu9wy5qjvsbR5xC3wg`

The dynamic portal therefore has a long-haul server-to-database path for authenticated requests.

## Database size and execution evidence

Current approximate table sizes are small:

- customers: ~619 rows
- vehicles: ~656 rows
- policies: ~654 rows
- claims: ~33 rows

A representative full customer-register SQL query, including per-customer vehicle, policy and claim counts, completed inside Postgres in approximately **8.98 ms**.

Conclusion: current 5–6 second route latency is not explained by raw Postgres execution time or dataset size. The dominant costs are outside the SQL engine: network geography, request sequencing, authentication/permission round-trips, server rendering, and unnecessary background navigation work.

## Critical live finding: automatic prefetch storm

Vercel production runtime logs showed that opening register pages caused expensive edit/create routes to be prefetched automatically.

Observed examples included simultaneous requests for:

- multiple `/policies/<id>/edit` routes plus `/policies/new`
- multiple `/vehicles/<id>/edit` routes plus `/vehicles/new`

These are authenticated server-rendered workflows and can themselves perform Supabase reads. Prefetching ten or more of them creates avoidable concurrent Vercel→Supabase work and competes with the route the user actually requested.

### Remediation

The Customers, Vehicles and Policies register workspaces now set `prefetch={false}` on create/edit workflow links.

A regression script was added:

`apps/web-portal/scripts/register-workflow-prefetch-regression.mjs`

and the canonical Verify web portal workflow runs it.

Read-only navigation remains eligible for normal prefetch behavior.

## Duplicate permission/scope round-trip

Current protected register rendering first resolves effective capability access and then resolves employee access scope. Before this remediation, both paths independently queried the same active `employee_permission_overrides` row.

### Remediation

A request-scoped cached active employee permission override lookup is shared by permission and scope resolution. Authorization semantics are unchanged; the duplicate Supabase lookup is removed.

## Policies register serial reads

The Policies page loaded active intermediary source options and only afterward loaded the policy register, even though those reads are independent once access scope is known.

### Remediation

The active intermediary source read and policy register read now execute in parallel for non-empty scopes. Empty-scope handling remains fail-closed.

## Global client bundle / hydration

The root layout mounted policy edit-copy and policy save-confirmation behavior on every portal route.

### Remediation

Those policy-only helpers are now loaded through a route-scoped dynamic client component and are only requested on `/policies...` routes.

This reduces unrelated route hydration/bundle work without changing policy workflow behavior.

## Region remediation experiment

This performance branch configures:

```json
"regions": ["icn1"]
```

for an exact-code Vercel region experiment, because `icn1` is close to the Seoul Supabase region.

**This is not authorization to change production.**

Repository policy requires:
1. exact-revision comparison,
2. successful canonical verification,
3. rollback instructions,
4. explicit user approval before a production region switch.

If approved after verification, the expected architecture becomes:

India user → Vercel Seoul → Supabase Seoul

instead of:

India user → Vercel Washington D.C. → Supabase Seoul.

Static assets remain globally edge-cached; this change targets dynamic server compute.

## Authentication hot path

The current server authentication helper uses `supabase.auth.getUser()`, which always makes a network request to Supabase Auth.

Current Supabase guidance recommends `auth.getClaims()` for protecting server pages because asymmetric JWT signing keys can be verified locally through cached JWKS.

This is a promising future reduction of one regional Auth call per protected render, but it is **not changed in this remediation until every caller's dependency on the full user object is audited**. Authentication correctness takes priority over speed.

## Database advisors

Supabase Performance Advisor currently reports multiple categories including:

- unindexed foreign keys
- multiple permissive RLS policies
- duplicate indexes
- other policy/index recommendations

These findings are not being bulk-applied.

Reasons:
- the measured representative SQL is already single-digit milliseconds;
- many portal server reads use trusted server-side access paths;
- RLS changes are security-sensitive;
- unused/duplicate index cleanup requires workload evidence;
- indiscriminate indexes can slow writes and increase maintenance.

Any future DB remediation must be query-plan-driven and separately verified.

## Remaining structural work

The Customers, Vehicles and Policies registers still load all currently accessible rows and perform client-side filtering/pagination. At the present ~650-row scale this is not the primary cause of 5–6 second latency, but it will become a scale limit.

A future server-pagination phase should preserve:
- global metrics
- search/filter semantics
- selection/export behavior
- scoped authorization
- IT super-user behavior
- deep links
- no silent truncation

Claims currently has only ~33 rows, so server pagination there has little current value.

## Current remediation branch

Branch:

`perf/2026-08-30-full-speed-remediation`

Draft PR:

`#825 — Audit and remediate web portal performance`

Scope in this PR:
- `icn1` region experiment configuration
- expensive workflow prefetch suppression
- prefetch regression guard
- duplicate permission/scope lookup removal
- Policies independent-read parallelization
- policy-only client helper lazy loading
- this audit record

## Merge / deployment gate

Do not merge or deploy until:

- canonical web verification is green on the exact final head;
- branch is synchronized with current `main`;
- changed-file review confirms no unrelated workflow/security changes;
- region change has explicit user approval after the findings are presented.

After production deployment, repeat the authenticated India route benchmark and compare against the August baseline.
