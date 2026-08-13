# Operations & Compliance Reporting Handoff

> Updated: 2026-08-13 IST
>
> Read with `AGENTS.md`, `docs/INSUREIT_PROJECT_CONTEXT.md`, `docs/CURRENT_CHAT_HANDOFF.md`, `docs/REPORTS_IMPLEMENTATION_HANDOFF.md`, and `docs/CLAIMS_REPORTING_HANDOFF.md`.

## Release boundary

Reports phases through Finance are already present in the production snapshot. Phase 6 Operations & Compliance is implemented on `main` and its Supabase backend is applied, but it is **not intentionally deployed** until the user explicitly asks for another production release.

## Route

```text
/reports/operations
```

## Product rule

Keep this report factual and exception-oriented. The current production data has no stored Fitness/PUC/Road Tax/National Permit/Local Permit expiry dates and no customer KYC-document rows, so do not invent compliance percentages or health scores.

The report treats missing operational data as an actionable exception rather than pretending those vehicles are compliant.

## UI

Implemented:

- heading `Operations & compliance`;
- Reports navigation through Business / Distribution / Renewals / Claims / Finance / Operations on the main Reports page and Operations page;
- compliance horizons: 30 / 60 / 90 / 180 / 365 days;
- exception filters: Missing compliance data, Expired documents, Due within horizon, AuthBridge unverified;
- KPIs: Vehicles, AuthBridge Verified, Missing Compliance, Missing Fields, Expired, Due within horizon;
- Vehicle compliance table for Fitness / PUC / Road Tax / National Permit / Local Permit;
- customer-document counters for Total / Verified / Pending / Rejected / Customers with exceptions;
- paginated Vehicle Exception Register with customer, vehicle, registration status, AuthBridge status, each compliance expiry, missing/expired/due counters, and vehicle drill-through;
- hierarchy-scoped CSV export capped at 10,000 rows.

Files:

```text
apps/web-portal/lib/reports/operations.ts
apps/web-portal/app/reports/operations/page.tsx
apps/web-portal/app/reports/export/operations/route.ts
supabase/migrations/20260813065012_operations_compliance_reporting.sql
```

## Access control

Uses the existing Reports access model:

```text
requireCapability("view_reports")
getAccessibleCustomerIds(profile.id, profile.role, "view_reports")
getEmployeeAccessScope(profile.id, profile.role, "view_reports")
```

The server resolves accessible customer IDs before calling the reporting RPC through the Supabase admin client. The export follows the same loader/scope path.

## Backend

Live Supabase migration:

```text
20260813065012 operations_compliance_reporting
```

Function:

```text
public.get_operations_compliance_report(uuid[], integer, text, integer, integer)
```

Security:

- `SECURITY DEFINER`;
- fixed `search_path = public`;
- execute revoked from `PUBLIC`, `anon`, and `authenticated`;
- live ACL inspection confirms only `postgres` and `service_role` execute access.

Primary sources:

```text
vehicles
customers
customer_documents
```

## Live smoke evidence at implementation time

Organization-wide smoke returned:

- 12 vehicles;
- 0 AuthBridge-verified vehicles;
- 12 vehicles with missing compliance data;
- 60 missing compliance-date fields (5 tracked fields × 12 vehicles);
- 0 expired documents;
- 0 documents due within the 90-day horizon;
- 0 customer-document rows.

These values are transient evidence only and must never be hard-coded.

## Verification

Canonical verification is run by `.github/workflows/verify-web-portal.yml`. Record the final successful run/head here after CI finishes. Do not deploy if the compulsory access-control/security regressions, TypeScript, lint, or production build are not green.

## Next phase

After Operations & Compliance is trusted, proceed to Governance reporting as a separate sensitive report. Audit logs, permission overrides, and permission-change history should not automatically inherit ordinary portfolio `view_reports` visibility; determine the correct elevated capability before exposing governance data.
