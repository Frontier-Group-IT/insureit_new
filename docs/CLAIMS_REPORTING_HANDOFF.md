# Claims Reporting Handoff

> Updated: 2026-08-13 IST
>
> Read with `AGENTS.md`, `docs/INSUREIT_PROJECT_CONTEXT.md`, `docs/CURRENT_CHAT_HANDOFF.md`, and `docs/REPORTS_IMPLEMENTATION_HANDOFF.md` before continuing Reports work.

## Release boundary

Reports Phase 3 Renewals is deployed to production as part of the latest verified main production snapshot.

Production evidence:

- GitHub Actions deploy run: `31671745605` — SUCCESS.
- Vercel deployment: `dpl_8QvNZ2PBkyFFGDSNxuAVDfjTQQ1X`.
- Vercel state: READY.
- Production alias: `portal.insureit.in`.
- Post-deploy runtime error check for `/reports/renewals` and `/reports/export/renewals`: none in the selected window.

Claims reporting described below is **implemented, database-applied, and verified, but not intentionally deployed**. Do not update `.deploy/production-trigger.json` for Claims unless the user explicitly asks to deploy it.

## Claims reporting route

```text
/reports/claims
```

Implemented UI:

- `Claims portfolio & aging` page;
- Last 90 days, MTD, YTD, All time, and custom date filtering;
- insurance company, claim status, and service-mode filters;
- factual KPIs for Claims, Open, Settled, Average Open Age, Estimated Loss, and Settlement;
- open-claim aging buckets: 0–7, 8–15, 16–30, 31–60, and 61+ days;
- claim-status distribution;
- insurer claim exposure table;
- pending/rejected document exception KPIs;
- paginated claim register with customer/vehicle, policy/insurer, status/service mode, aging, financial values, document count, and claim drill-through;
- hierarchy-scoped CSV export with 10,000-row hard limit.

Current live production data contains zero claim rows. The report intentionally renders factual zero states; do not seed fake claims solely to populate the report.

## Authorization

Claims Reports use the existing Reports access-control model:

```text
requireCapability("view_reports")
getAccessibleCustomerIds(profile.id, profile.role, "view_reports")
getEmployeeAccessScope(profile.id, profile.role, "view_reports")
```

The server resolves accessible customer IDs before calling the admin RPC. Organization-scoped users can see organization claims, hierarchy users are restricted to claims belonging to accessible customer portfolios, and self-scoped users remain limited to their assigned portfolio.

Do not introduce a separate Claims Reports ownership model.

## Backend

Live Supabase migration:

```text
20260813055613 claims_reporting
```

Repository replay file:

```text
supabase/migrations/20260813055613_claims_reporting.sql
```

Function:

```text
public.get_claims_report(...)
```

Primary sources:

```text
claims
claim_documents
customers
vehicles
policies
insurance_companies
```

The function is `SECURITY DEFINER` with fixed `search_path = public`. Execute privilege inspection confirms only `postgres` and `service_role` can execute it; `PUBLIC`, `anon`, and `authenticated` are revoked.

Closed/non-open statuses are treated as:

```text
Settled
Rejected
Closed
Claim Complete
```

Settled count uses `Settled` and `Claim Complete`. Rejected is separately counted.

Document exceptions use the actual `claim_documents.verification_status` enum values:

```text
pending
verified
rejected
```

## Server/UI files

```text
apps/web-portal/lib/reports/claims.ts
apps/web-portal/app/reports/claims/page.tsx
apps/web-portal/app/reports/export/claims/route.ts
supabase/migrations/20260813055613_claims_reporting.sql
```

## Verification

Feature head:

```text
ca3d991cf4c6eaf3de4b2f001084a49ae129a302
```

Workflow:

```text
Verify web portal
Run: 31672137151
Result: SUCCESS
```

Passed:

- Access Control V2 catalogue regression;
- Access Control V2 scope and compatibility regression;
- Access Control V2 portal lifecycle regression;
- Employee portal governance regression;
- Release blocker security regression;
- IFFCO structured regression;
- IFFCO regression;
- Digit regression;
- New India regression;
- Typecheck;
- Lint;
- Production build.

Live RPC zero-state smoke test returned a valid report object with all counters at zero and all five aging buckets present.

## Next report phase

After Claims review/deployment, proceed to Finance reporting. Finance must align with the current billed-only PayIn workflow and should report insurer projected pay-in, billed pay-in, intermediary payout, retention/margin, and exceptions from real stored values only. Do not infer receivables or payout liabilities that are not represented by the existing workflow/state.
