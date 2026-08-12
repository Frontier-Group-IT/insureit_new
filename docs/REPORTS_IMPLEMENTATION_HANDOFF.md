# Reports Implementation Handoff

> Updated: 2026-08-13 IST
>
> Read with `AGENTS.md`, `docs/INSUREIT_PROJECT_CONTEXT.md`, `docs/CURRENT_CHAT_HANDOFF.md`, and `docs/PERFORMANCE_OPTIMIZATION_HANDOFF.md` before continuing Reports work.

## Current state

Reports Phase 1 is implemented and verified on `main`, but is **not intentionally deployed to production yet**. Do not modify `.deploy/production-trigger.json` unless the user explicitly says `deploy now` or `finish and deploy`.

The previous `/reports` page was a static catalogue/blueprint with seven report families and 23 planned report cards. Phase 1 replaces that user-facing catalogue with a real, professional Business / Policy Production reporting workspace backed by live Supabase data.

## Phase 1 user experience

`apps/web-portal/app/reports/page.tsx` now provides:

- neutral professional report layout instead of multi-colour concept cards;
- data-scope label and current as-of timestamp;
- quick periods: Last 90 days (default), Month to date, Year to date, All time;
- custom From / To dates;
- Insurance Company, Relationship Manager and Partner / intermediary filters;
- live KPI strip: Policies, Gross Premium, Net Premium, Average Premium, contributing intermediaries;
- monthly premium-production trend;
- OD / TP / CPA premium composition;
- insurer contribution table with policy count, gross premium and share;
- RM production table with policy count, intermediary count and gross premium;
- paginated Policy Business Register with drill-through to policy detail;
- responsive mobile register cards;
- controlled CSV export using the exact same authorization scope and active report filters;
- explicit unavailable state if the reporting service fails; figures are never estimated or substituted.

## Access-control rule

Reports do not implement a separate ownership model.

The server loader uses:

```text
requireCapability("view_reports")
getAccessibleCustomerIds(profile.id, profile.role, "view_reports")
getEmployeeAccessScope(profile.id, profile.role, "view_reports")
```

Therefore the report follows the same effective role/override scope model as the rest of the portal:

- organization-scoped report viewers receive organization data;
- reporting-hierarchy viewers receive only customers/business in the employee/intermediary hierarchy resolved by the common access-scope engine;
- self-scoped viewers receive only their portfolio;
- no `view_reports` capability means the page/export route is denied.

Do not add an unrestricted report/export query to work around scope filtering.

## Reporting backend

Migration file:

```text
supabase/migrations/20260813004500_policy_business_reporting.sql
```

Live original Supabase project `ilzhsfqqjyppzzvfscmh` has the migration applied.

Function:

```text
public.get_policy_business_report(
  p_customer_ids uuid[],
  p_from_date date,
  p_to_date date,
  p_insurer_id uuid,
  p_rm_name text,
  p_intermediary_code text,
  p_page integer,
  p_page_size integer
) returns jsonb
```

It performs server-side aggregation and pagination rather than loading the full policy dataset into the browser. Returned sections are:

- `summary`
- `trend`
- `insurers`
- `rms`
- `filters`
- paginated `register`

Primary data sources:

```text
policies
policy_premium_details
customers
vehicles
insurance_companies
intermediaries
```

The business date is `coalesce(policies.issuance_date::date, policies.created_at::date)`.

### RPC security

Second migration:

```text
supabase/migrations/20260813005000_lock_policy_business_reporting.sql
```

This is also applied to the live original Supabase project.

The reporting RPC is deliberately **not executable** by `PUBLIC`, `anon`, or `authenticated`. Execute privilege is granted only to `service_role` (plus database owner/postgres). The browser never supplies its own scope directly to the RPC. The Next.js server resolves authorization first, then calls the RPC with the scoped customer ID set through the server-only admin client.

Privilege verification against `information_schema.routine_privileges` confirmed only `postgres` and `service_role` execute grants for this RPC.

Supabase security advisor was run after the DDL. It reported pre-existing project-wide lints but did not flag the new reporting RPC as publicly executable. Do not conflate the existing advisor backlog with this new function.

## Server files

```text
apps/web-portal/lib/reports/policy-business.ts
apps/web-portal/lib/reports/policy-business-export.ts
apps/web-portal/app/reports/export/policy-business/route.ts
```

`policy-business.ts` resolves dates/filters, common access scope, calls the service-role-only RPC and normalizes the JSON payload.

`policy-business-export.ts` reuses the same scope and filters, reads in server-side pages of 200 and has a hard 10,000-row limit.

The CSV route:

- requires `view_reports`;
- exports only the authorized/filter-matched dataset;
- includes business/policy/customer/vehicle/insurer/RM/intermediary and premium fields;
- does not export PAN, Aadhaar, phone or raw OCR information;
- returns HTTP 422 and asks the user to narrow filters when more than 10,000 rows match instead of silently truncating;
- uses `Cache-Control: private, no-store`.

## Live smoke evidence

A live RPC smoke against the current 90-day business set returned:

```text
Policies: 4
Active policies: 4
Gross premium: 294681.8574
Net premium: 268334.93
OD premium: 99462.93
TP premium: 168872
CPA: 0
Insurers: 3
Intermediaries: 1
```

The monthly trend currently resolves one June policy and three July policies.

The insurer split currently resolves three insurers, and RM production resolves the four policies to Parsottam with one intermediary.

A separate live SQL reconstruction of the user-provided Jatin -> Parsottam -> Anmol hierarchy passed the resulting accessible customer IDs into the reporting RPC and produced the same 4-policy scoped summary. This validates that the reporting aggregate is compatible with the hierarchy model rather than exposing organization totals to the Sales Head.

Do not encode these live counts in UI code; they are smoke evidence only and will change as business data changes.

## Verification

Initial feature head `1d0d86f322e6a8ec1cee68852e658db389cb4f58` passed all access-control/security/OCR regressions but failed TypeScript only because `requireCapability()` had a nullable inferred return type.

The shared helper was tightened without changing authorization behavior:

```text
apps/web-portal/lib/master-data-server.ts
```

`requireCapability()` now explicitly rejects a null profile before checking the effective capability, allowing TypeScript to correctly infer a non-null returned profile.

Final verified head:

```text
b0d086e14ee9bbb66ec16ae030bc376db102c057
```

Canonical GitHub Actions verification:

```text
Workflow: Verify web portal
Run: 31632806025
Result: SUCCESS
Access Control V2 catalogue regression: passed
Access Control V2 scope and compatibility regression: passed
Access Control V2 portal lifecycle regression: passed
Employee portal governance regression: passed
Release blocker security regression: passed
IFFCO structured regression: passed
IFFCO regression: passed
Digit regression: passed
New India regression: passed
Typecheck: passed
Lint: passed
Production build: passed
```

## Production state

The two Supabase reporting migrations are already applied because the server-side reporting backend had to be smoke-tested against the original project.

The new web Reports UI/export code is committed and verified on `main`, but no Reports-specific production trigger was created in this work. Do not claim the new web page is live until a deployment containing this head is verified on Vercel and aliased to `portal.insureit.in`.

## Planned next phases

Continue only after user review/approval of Phase 1 direction.

Recommended sequence:

1. Distribution: RM performance, intermediary business, onboarding pipeline.
2. Renewals: expiry-based due/expired/premium-at-risk first; do not invent conversion/lost-reason metrics until a real renewal lifecycle exists.
3. Claims: portfolio, aging, financial and document-exception reporting.
4. Finance: insurer projected pay-in / billed pay-in / intermediary payout / margin reporting, aligned with the current PayIn workflow state.
5. Operations and Governance: KYC/onboarding workload, AuthBridge usage, audit and permission/access reports.
6. Month-end management pack only after component reports are trusted.

Keep reports data-rich and table-first. Use charts sparingly and only when they improve interpretation. Status colours should be semantic, not decorative.
