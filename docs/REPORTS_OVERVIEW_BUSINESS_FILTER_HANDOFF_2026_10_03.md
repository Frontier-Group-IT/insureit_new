# Reports Overview global Business Type filter — 2026-10-03

## Scope

Branch: `fix/reports-overview-business-filter`

This change repairs the Reports → Overview Business Type selector so `All Business`, `Motor`, `Non Motor`, `Life`, and `Health` apply consistently to the business-sensitive Overview metrics and supporting export.

## Root cause

The Overview page still translated `Life` and `Health` into the legacy `Non Motor + category` model even though the canonical policy/finance reporting contracts now store and filter `Life` and `Health` as first-class `business_line` values. In addition, Claims had no business filter, Renewals only parsed Motor/Non Motor, the management pack did not propagate business scope into Renewals/Operations, and vehicle compliance was organization-wide.

## Read-only production evidence captured before implementation

For the Overview `Last 6 Months` range used in the reported screenshot, canonical `Life` filtering returned 5 policies, net premium ₹91,28,642, PayIn after TDS ₹37,97,340.57 and payout ₹59,14,871.22, while the legacy `Non Motor + Life` Overview mapping returned zero. Current open claims consisted of 2 Motor-linked and 2 unlinked claims, with no Life-linked open claim. The 5 current Life policies had no linked vehicle, so vehicle-compliance exceptions must not be inherited from the organization-wide vehicle population when Life is selected.

## Implementation

- Overview now resolves each selector value directly to the canonical business line: `Motor`, `Non Motor`, `Life`, or `Health`.
- `loadManagementPack()` propagates the same business/category scope to Business, Finance, Claims, Renewals and Operations.
- Claims now use `get_claims_report_v2`, which accepts optional business/category filters. Unlinked claims remain visible under All Business but are excluded whenever a specific business is selected.
- Renewals now preserve all four business lines and continue using the existing `get_renewal_report_v4` contract.
- Operations now use `get_operations_compliance_report_v2`, which scopes vehicles through policies linked to those vehicles. Life/Health therefore return zero vehicle-compliance records when their policies have no linked vehicles instead of showing global Motor-heavy compliance counts.
- The Overview management-pack export receives the same canonical business scope, so its business-sensitive sections reconcile with the page.

## Schema and rollout

Migration: `supabase/migrations/20261003123000_reports_overview_business_filter.sql`

New service-role-only RPCs:

- `public.get_claims_report_v2(uuid[],date,date,uuid,text,text,text,text,integer,integer)`
- `public.get_operations_compliance_report_v2(uuid[],integer,text,text,text,integer,integer)`

Existing Claims and Operations RPCs remain in place for backward compatibility.

Protected schema workflow: `.github/workflows/apply-reports-overview-business-filter.yml`

The production deployment workflow recognizes migration version `20261003123000` and waits for the protected schema workflow before invoking the Vercel production deploy hook.

## Regression coverage

`apps/web-portal/scripts/reports-business-type-filter-regression.mjs` now guards:

- canonical Overview mapping for all four business lines;
- no legacy Life/Health → Non Motor translation;
- management-pack propagation to Claims/Renewals/Operations;
- four-line Claims/Renewals/Operations filter parsing;
- exclusion of unlinked claims under a specific business filter;
- policy-linked vehicle scoping for Operations;
- service-role-only RPC grants;
- protected migration workflow and production deployment gate.

The existing canonical `Verify web portal` workflow already runs this regression. CI evidence must be recorded from the final PR head before merge.

## Safety state

At handoff creation time the changes are implemented only on the feature branch. Production Supabase has not been modified, the migration has not been applied, the branch is not merged, and no APK/AAB/mobile build is involved.
