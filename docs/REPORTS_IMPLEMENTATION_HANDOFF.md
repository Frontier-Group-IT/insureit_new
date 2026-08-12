# Reports Implementation Handoff

> Updated: 2026-08-13 IST
>
> Read with `AGENTS.md`, `docs/INSUREIT_PROJECT_CONTEXT.md`, `docs/CURRENT_CHAT_HANDOFF.md`, and `docs/PERFORMANCE_OPTIMIZATION_HANDOFF.md` before continuing Reports work.

## Current state

**IMPLEMENTED / APPLIED / DEPLOYED / VERIFIED:** Reports Phase 1 is live on the canonical production portal at `https://portal.insureit.in/reports`.

The previous `/reports` page was a static catalogue/blueprint with seven report families and 23 planned report cards. Phase 1 replaces that user-facing catalogue with a real Business / Policy Production reporting workspace backed by live Supabase data.

## Phase 1 user experience

`apps/web-portal/app/reports/page.tsx` provides:

- neutral professional report layout;
- data-scope label and current as-of timestamp;
- quick periods: Last 90 days (default), Month to date, Year to date, All time;
- custom From / To dates;
- Insurance Company, Relationship Manager and Partner / intermediary filters;
- KPI strip: Policies, Gross Premium, Net Premium, Average Premium, contributing intermediaries;
- monthly premium-production trend;
- OD / TP / CPA premium composition;
- insurer contribution table with policy count, gross premium and share;
- RM production table with policy count, intermediary count and gross premium;
- paginated Policy Business Register with drill-through to policy detail;
- responsive mobile register cards;
- controlled CSV export using the same authorization scope and active report filters;
- explicit unavailable state if the reporting service fails; figures are never estimated or substituted.

## Access-control rule

Reports do not implement a separate ownership model. The server loader uses:

```text
requireCapability("view_reports")
getAccessibleCustomerIds(profile.id, profile.role, "view_reports")
getEmployeeAccessScope(profile.id, profile.role, "view_reports")
```

Therefore:

- organization-scoped report viewers receive organization data;
- reporting-hierarchy viewers receive only customers/business in the employee/intermediary hierarchy resolved by the common access-scope engine;
- self-scoped viewers receive only their portfolio;
- no `view_reports` capability means the page/export route is denied.

Do not add an unrestricted report/export query to work around scope filtering.

## Reporting backend

Applied migrations in the original Supabase project `ilzhsfqqjyppzzvfscmh`:

```text
20260813004500_policy_business_reporting.sql
20260813005000_lock_policy_business_reporting.sql
```

The reporting function is:

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

It performs server-side aggregation and pagination over:

```text
policies
policy_premium_details
customers
vehicles
insurance_companies
intermediaries
```

Business date is `coalesce(policies.issuance_date::date, policies.created_at::date)`.

### RPC security

The reporting RPC is deliberately not executable by `PUBLIC`, `anon`, or `authenticated`. Execute privilege is granted only to `service_role` plus database owner/postgres. The browser does not submit its own authorization scope directly to the RPC; the Next.js server resolves the effective customer scope first and calls the RPC through the server-only admin client.

Privilege verification confirmed only `postgres` and `service_role` execute grants. Supabase security advisor was run after the DDL and did not flag the new reporting RPC as publicly executable. Existing unrelated project-wide advisor findings remain separate backlog.

## Server files

```text
apps/web-portal/lib/reports/policy-business.ts
apps/web-portal/lib/reports/policy-business-export.ts
apps/web-portal/app/reports/export/policy-business/route.ts
```

The CSV export:

- requires `view_reports`;
- exports only the authorized/filter-matched dataset;
- includes business/policy/customer/vehicle/insurer/RM/intermediary and premium fields;
- excludes PAN, Aadhaar, phone and raw OCR information;
- uses a hard 10,000-row limit and returns HTTP 422 asking the user to narrow filters if exceeded;
- uses `Cache-Control: private, no-store`.

## Live smoke evidence

A live reporting smoke against the current sample portfolio returned:

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

A separate live SQL reconstruction of the Jatin -> Parsottam -> Anmol hierarchy passed the resulting accessible customer IDs into the reporting RPC and produced the same four-policy scoped summary. These counts are smoke evidence only and must never be encoded in UI code.

## Verification

Final feature verification before release:

```text
Feature head: b0d086e14ee9bbb66ec16ae030bc376db102c057
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

The shared `requireCapability()` helper now explicitly rejects a null profile before checking the effective capability. This was a TypeScript narrowing fix and did not weaken authorization behavior.

## Production deployment evidence

User explicitly requested deployment on 2026-08-13 IST.

```text
Reports handoff pre-trigger head: 0180ad6e9966da06d2fa7142927e2be04f2bc5a9
Production trigger commit: 0e80c0f8ff21c305736a02bc48cfbcec1447d03c
GitHub Actions production run: 31633330860
Compulsory verification gate: SUCCESS
Trigger Vercel production deployment job: SUCCESS
Vercel deployment: dpl_oTejS9amPxmTKA8VoLzKAKUqotyc
Vercel URL: insureit-6bbp6x61p-antnish1s-projects.vercel.app
Vercel state: READY
Production alias: portal.insureit.in
Alias error: none
```

Production smoke after READY:

- unauthenticated `https://portal.insureit.in/reports` resolved successfully through the production deployment and served the expected login page because Reports is protected;
- the response was served from the canonical `portal.insureit.in` alias;
- Vercel runtime-error check for `/reports` and `/reports/export/policy-business` found no runtime errors in the selected post-deploy window.

Do not treat the unauthenticated smoke as proof of every authenticated filter/export interaction. The deployment, routing and protected-entry behavior are verified; authenticated business validation should use normal user testing when product review is requested.

## Planned next phases

Recommended sequence after Phase 1 review:

1. Distribution: RM performance, intermediary business, onboarding pipeline.
2. Renewals: expiry-based due/expired/premium-at-risk first; do not invent conversion/lost-reason metrics until a real renewal lifecycle exists.
3. Claims: portfolio, aging, financial and document-exception reporting.
4. Finance: insurer projected pay-in / billed pay-in / intermediary payout / margin reporting, aligned with the current PayIn workflow state.
5. Operations and Governance: KYC/onboarding workload, AuthBridge usage, audit and permission/access reports.
6. Month-end management pack only after component reports are trusted.

Keep reports data-rich and table-first. Use charts sparingly and only when they improve interpretation. Status colours should be semantic, not decorative.
