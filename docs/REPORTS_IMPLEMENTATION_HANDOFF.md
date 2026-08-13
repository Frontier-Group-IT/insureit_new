# Reports Implementation Handoff

> Updated: 2026-08-13 IST
>
> Read with `AGENTS.md`, `docs/INSUREIT_PROJECT_CONTEXT.md`, `docs/CURRENT_CHAT_HANDOFF.md`, and `docs/PERFORMANCE_OPTIMIZATION_HANDOFF.md` before continuing Reports work.

## Current state

Reports Phase 1 Business / Policy Production is **DEPLOYED** at `https://portal.insureit.in/reports`.

Reports Phase 2 Distribution and the user-requested Phase 1 text cleanup are **DEPLOYED**. Production evidence: GitHub production workflow `31667947448` passed and Vercel deployment `dpl_CNNzZzNygmsLqHsipvxSrHmuVGCs` reached READY with `portal.insureit.in` attached.

Reports Phase 3 Renewals is **IMPLEMENTED / APPLIED / VERIFIED**, but is **not intentionally deployed** yet. Do not update `.deploy/production-trigger.json` until the user explicitly requests deployment.

The reports product is data-first and table-first. Keep only main page/section names, filters, factual KPI labels, status labels, table headers and actions. Do not reintroduce explanatory dashboard copy such as data-scope descriptions, as-of cards, report-purpose paragraphs or decorative helper text unless the user explicitly asks.

## Phase 1 — Business / Policy Production

Route: `/reports`

Current UI contains Policy production & portfolio, Business / Distribution / Renewals report navigation, period/date filters, insurer/RM/intermediary filters, policy and premium KPIs, Premium production trend, Premium composition, Insurance company contribution, RM production, paginated Policy business register and scoped CSV export.

Backend migrations:

```text
20260812192044 policy_business_reporting
20260812192238 lock_policy_business_reporting
```

Function: `public.get_policy_business_report(...)`. Browser execution is not allowed; server access uses the service role after portal authorization/scope resolution.

## Phase 2 — Distribution

Route: `/reports/distribution`

Implemented UI: Distribution performance, period/date filters, RM/intermediary type/account-status filters, Intermediaries/Active/Producing/Policies/Gross Premium/Open Onboarding KPIs, RM performance, intermediary business and onboarding pipeline tables.

Server loader: `apps/web-portal/lib/reports/distribution.ts`.

It reuses the access-control engine through `view_reports`, `getAccessibleIntermediaryIds`, `getAccessibleIntermediaryApplicationIds` and `getEmployeeAccessScope`.

Backend migrations:

```text
20260812200001 distribution_reporting
20260812200534 fix_distribution_reporting_rm_assignment
```

Function: `public.get_distribution_report(...)`, `SECURITY DEFINER`, fixed `search_path=public`, browser execute privilege revoked.

Canonical RM attribution rule:

```text
coalesce(intermediaries.associate_employee_id,
         posp_misp_onboarding_profiles.associate_employee_id)
```

Do not regress to intermediary-row-only attribution.

## Phase 3 — Renewals

Route: `/reports/renewals`

Purpose: factual expiry-risk reporting only. Do **not** add conversion, lost-renewal, competitor, contacted, quoted or lost-reason metrics until a real renewal lifecycle records those states.

### UI

- page heading `Renewal pipeline`;
- Business / Distribution / Renewals navigation;
- horizon controls: 30 / 60 / 90 / 180 / 365 days;
- default horizon: 365 days, because the current live portfolio mostly expires in June/July 2027 and a 30/90-day default would currently open empty;
- insurer, RM, intermediary and expiry-bucket filters;
- KPIs: Upcoming, Due in 30 days, Due in 90 days, Expired, Customers, Premium at risk;
- expiry buckets: Expired, 0–30, 31–60, 61–90, 91–180, 181–365;
- Insurance company exposure table;
- RM renewal exposure table;
- paginated Renewal register with policy drill-through;
- scoped CSV export capped at 10,000 rows.

Files:

```text
apps/web-portal/lib/reports/renewals.ts
apps/web-portal/app/reports/renewals/page.tsx
apps/web-portal/app/reports/export/renewals/route.ts
```

### Access control

Renewals reuse:

```text
requireCapability("view_reports")
getAccessibleCustomerIds(profile.id, profile.role, "view_reports")
getEmployeeAccessScope(profile.id, profile.role, "view_reports")
```

Authorized customer IDs are resolved server-side before the reporting RPC is invoked through the Supabase admin client. The export uses the same scope/filter path.

### Backend

Live Supabase migrations:

```text
20260813053750 renewal_reporting
20260813053837 fix_renewal_reporting_intermediary_columns
```

Function: `public.get_renewal_report(...)`.

Security:

- `SECURITY DEFINER`;
- fixed `search_path=public`;
- execute revoked from `PUBLIC`, `anon`, `authenticated`;
- live ACL inspection confirms only `postgres` and `service_role` execute access.

The second migration corrected intermediary filter lookup fields to `intermediaries.intermediary_code`, `display_name` and `legal_name`.

Live organization-level smoke at implementation time returned 10 upcoming policies, 0 expired, approximately ₹5.72L gross premium at risk, nearest expiry 2027-06-21, four insurers, and the current policies in the 181–365-day bucket. These are transient smoke values only and must never be hard-coded.

### Verification

```text
Feature head: 2aefad1c10a823bcded2bdb51ad2b6e4e36ebe70
Workflow: Verify web portal
Run: 31671384963
Result: SUCCESS
```

Passed: Access Control V2 catalogue, scope/compatibility, lifecycle, employee portal governance, release-blocker security, IFFCO structured, IFFCO, Digit, New India, TypeScript, lint and Next.js production build.

Supabase security advisor was run after the Phase 3 DDL. The new `get_renewal_report` function is not exposed to anon/authenticated roles. The advisor continues to report multiple pre-existing project-wide security findings; handle those as a separate security-hardening workstream rather than silently changing unrelated production behavior during Reports development.

## Access-control invariant

Reports must never bypass normal portal access scope. Every report and export must resolve authorization server-side before using the Supabase admin client/RPC. Do not expose reporting RPC execute access to browser roles merely to simplify client-side filtering.

## Production / deployment invariant

Normal report commits do not intentionally deploy production. Only update `.deploy/production-trigger.json` after an explicit user deployment request. The production workflow must rerun the compulsory verification gate before Vercel receives a deploy-hook request.

## Next phases

1. Claims: portfolio, aging, financial and document-exception reporting.
2. Finance: insurer projected pay-in / billed pay-in / intermediary payout / margin reporting aligned with the current billed-only PayIn workflow.
3. Operations and Governance: KYC/onboarding workload, AuthBridge usage, audit and permission/access reports.
4. Month-end management pack only after component reports are trusted.
