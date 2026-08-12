# Reports Implementation Handoff

> Updated: 2026-08-13 IST
>
> Read with `AGENTS.md`, `docs/INSUREIT_PROJECT_CONTEXT.md`, `docs/CURRENT_CHAT_HANDOFF.md`, and `docs/PERFORMANCE_OPTIMIZATION_HANDOFF.md` before continuing Reports work.

## Current state

Reports Phase 1 Business / Policy Production is **DEPLOYED** at `https://portal.insureit.in/reports`.

Reports Phase 2 Distribution and the user-requested Phase 1 text cleanup are **IMPLEMENTED / APPLIED / UNDER FINAL CI VERIFICATION**, but are **not intentionally deployed** yet. Do not update `.deploy/production-trigger.json` until the user explicitly requests deployment.

The reports product is data-first and table-first. Keep only main page/section names, filters, factual KPI labels, status labels, table headers and actions. Do not reintroduce explanatory dashboard copy such as data-scope descriptions, as-of cards, report-purpose paragraphs or decorative helper text unless the user explicitly asks.

## Phase 1 — Business / Policy Production

Route:

```text
/reports
```

Current UI contains:

- page heading `Policy production & portfolio`;
- `Business` / `Distribution` report navigation;
- Last 90 days, MTD, YTD, All time and custom date filtering;
- insurer, RM and intermediary filters;
- Policies, Gross Premium, Net Premium, Average Premium and Intermediaries KPIs;
- Premium production trend;
- Premium composition;
- Insurance company contribution;
- RM production;
- paginated Policy business register;
- scoped CSV export.

Removed on 2026-08-13 at user request:

- descriptive report subtitle;
- `Data scope` display;
- `As of` display;
- KPI explanatory subtitles;
- section explanatory paragraphs;
- verbose empty/error helper text.

Keep reports professional, neutral and information-dense rather than decorative.

### Phase 1 backend

Applied original Supabase migrations:

```text
20260812192044 policy_business_reporting
20260812192238 lock_policy_business_reporting
```

Function:

```text
public.get_policy_business_report(...)
```

It aggregates `policies`, `policy_premium_details`, `customers`, `vehicles`, `insurance_companies` and `intermediaries` server-side. It is executable only by `service_role` plus database owner/postgres.

Server files:

```text
apps/web-portal/lib/reports/policy-business.ts
apps/web-portal/lib/reports/policy-business-export.ts
apps/web-portal/app/reports/export/policy-business/route.ts
```

The export uses the same authorization/filter scope, excludes PAN/Aadhaar/phone/raw OCR data and enforces a 10,000-row hard limit.

Phase 1 production evidence:

```text
Production trigger commit: 0e80c0f8ff21c305736a02bc48cfbcec1447d03c
GitHub Actions production run: 31633330860
Vercel deployment: dpl_oTejS9amPxmTKA8VoLzKAKUqotyc
State: READY
Alias: portal.insureit.in
Runtime error check: none for Reports routes in selected post-deploy window
```

## Phase 2 — Distribution

Route:

```text
/reports/distribution
```

Implemented UI:

- page heading `Distribution performance`;
- Business / Distribution navigation;
- Last 90 days, MTD, YTD, All time and custom date filters;
- RM, intermediary type and account-status filters;
- KPIs: Intermediaries, Active, Producing, Policies, Gross Premium, Open Onboarding;
- RM performance table: intermediaries, active, producing, policies, customers, gross premium;
- Intermediary business table: code/name, type, RM, account status, policies, customers, gross premium, last business, application drill-through;
- onboarding stage counts: Open, Compliance, Training, Exam, Agreement, IIB, Completed, Rejected;
- paginated Onboarding pipeline table with applicant/type/RM/stage/age/training/exam/agreement/IIB and application drill-through.

Server loader:

```text
apps/web-portal/lib/reports/distribution.ts
```

It reuses the existing access-control engine:

```text
requireCapability("view_reports")
getAccessibleIntermediaryIds(profile.id, profile.role, "view_reports")
getAccessibleIntermediaryApplicationIds(profile.id, profile.role, "view_reports")
getEmployeeAccessScope(profile.id, profile.role, "view_reports")
```

Therefore organization users receive organization data, hierarchy users receive only intermediary/application records inside their employee hierarchy, and self-scoped users receive only their assigned portfolio. Do not create a separate Reports ownership system.

### Phase 2 backend

Applied original Supabase migrations:

```text
20260812200001 distribution_reporting
20260812200534 fix_distribution_reporting_rm_assignment
```

Repository replay files:

```text
supabase/migrations/20260812200001_distribution_reporting.sql
supabase/migrations/20260812200534_fix_distribution_reporting_rm_assignment.sql
```

Function:

```text
public.get_distribution_report(...)
```

Returned sections:

```text
summary
rms
intermediaries
onboarding_summary
onboarding
filters
```

Primary sources:

```text
intermediaries
posp_misp_onboarding_profiles
intermediary_onboarding_applications
intermediary_training_exam_assignments
employees
policies
policy_premium_details
```

The function is `SECURITY DEFINER` with a fixed `search_path = public`. Execute privilege is revoked from `PUBLIC`, `anon` and `authenticated`; live privilege inspection confirms only `postgres` and `service_role` can execute it.

### Canonical RM attribution rule

Some Partner records do not carry `intermediaries.associate_employee_id` even though the onboarding profile contains the correct RM assignment. Distribution reporting must therefore resolve RM as:

```text
coalesce(intermediaries.associate_employee_id,
         posp_misp_onboarding_profiles.associate_employee_id)
```

Do not regress to intermediary-row-only RM attribution.

Live validation after this fix confirmed the user-provided hierarchy example resolves:

```text
Anmol Wadhwa -> Parsottam
Intermediaries: 1
Producing intermediaries: 1
Customers: 4
Policies: 4
Gross premium: 294681.8574
```

These values are smoke evidence only and must never be hard-coded.

A broader organization smoke currently returns 34 intermediaries, 31 active intermediaries, 18 Partners, 16 POSP, 4 policies and 35 onboarding applications. These figures will change with live data.

## Access-control invariant

Reports must never bypass normal portal access scope. Every report and future export must resolve authorization server-side before using the Supabase admin client/RPC.

Do not expose reporting RPC execute access to browser roles merely to simplify client-side filtering.

## Verification

Phase 1 pre-release verification:

```text
Feature head: b0d086e14ee9bbb66ec16ae030bc376db102c057
Workflow run: 31632806025
Result: SUCCESS
```

Phase 2 final verification must be recorded here after the exact final head completes the canonical `Verify web portal` workflow. Required checks include access-control regressions, release-blocker security regression, OCR regressions, TypeScript, lint and Next.js production build.

## Next phases

After Phase 2 review:

1. Renewals: expiry-based due/expired/premium-at-risk reporting first. Do not invent conversion/lost-reason metrics until a real renewal lifecycle exists.
2. Claims: portfolio, aging, financial and document-exception reporting.
3. Finance: insurer projected pay-in / billed pay-in / intermediary payout / margin reporting aligned with the current billed-only PayIn workflow.
4. Operations and Governance: KYC/onboarding workload, AuthBridge usage, audit and permission/access reports.
5. Month-end management pack only after component reports are trusted.
