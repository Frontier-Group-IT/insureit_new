# INSUREIT Reporting Data Quality & Operational Readiness Handoff

Date: 2026-08-13

## Purpose

This workstream follows completion of the core Reports roadmap and turns report-critical data gaps into an actionable exception register. It is not another decorative dashboard and does not calculate an artificial health/compliance score.

Primary route:
- `/reports/readiness`

CSV export:
- `/reports/export/readiness`

The main Reports page and Operations Reports page expose a `Readiness` navigation tab.

## Access model

Entry requires effective `view_reports`.

The loader resolves the same authorized customer portfolio used by the reporting suite through:
- `getAccessibleCustomerIds(profile.id, profile.role, "view_reports")`
- `getEmployeeAccessScope(profile.id, profile.role, "view_reports")`

The browser never supplies trusted customer-scope IDs. The server resolves scope first and then invokes the reporting RPC through the Supabase admin/service-role client.

The export uses the same scoped loader path and is capped at 10,000 exception rows.

## Backend

Live Supabase migration applied:
- `20260813090700_reporting_data_quality_readiness`

Repository migration:
- `supabase/migrations/20260813090700_reporting_data_quality_readiness.sql`

Function:
- `public.get_reporting_readiness_report(uuid[], text, integer, integer)`

Security:
- `SECURITY DEFINER`
- fixed `search_path=public`
- execute revoked from `public`, `anon`, and `authenticated`
- live ACL inspection confirmed only `postgres` and `service_role` have EXECUTE

The first DDL attempt was rejected before applying because the register JSON aggregation sorted on a field that had already been projected away. The corrected migration retained the internal sort field until aggregation and removed it from the returned JSON. The corrected version also normalizes nullable due-date counts.

## Readiness domains

### Vehicles

A vehicle appears when any of these conditions are present:
- Fitness expiry date missing
- PUC expiry date missing
- Road Tax expiry date missing
- National Permit expiry date missing
- Local Permit expiry date missing
- compliance document expired
- compliance document due within 30 days
- AuthBridge RC not verified
- registration status is `registration_pending`

Action drill-through:
- `/vehicles/<id>/edit`

Severity:
- critical: expired compliance document
- warning: missing compliance date or AuthBridge unverified
- attention: remaining operational backlog such as upcoming due/registration pending without a harder issue

### Policy & Finance

A policy appears when any of these conditions are present:
- insurance company missing
- gross premium missing/zero
- RM unassigned
- projected PayIn missing/zero
- billing details incomplete
- PayIn unbilled
- partner payout pending
- negative retention

Action drill-through:
- `/policies/<id>`

Severity:
- critical: missing insurer, missing premium, or negative retention
- warning: missing PayIn, incomplete billing, or unassigned RM
- attention: workflow-only backlog such as unbilled/pending payout without a harder issue

### Claims

A claim appears when claim documents are pending verification or rejected.

Action drill-through:
- `/claims/<id>`

Rejected documents are critical; pending-only verification is warning.

### Customer documents

A customer appears when customer documents are pending verification or rejected.

Action drill-through:
- `/customers/<id>/edit`

Rejected documents are critical; pending-only verification is warning.

## UI

Top KPIs:
- Exception records
- Critical
- Workflow backlog
- Missing compliance
- AuthBridge unverified
- Pending claim docs

Sections:
- Vehicle readiness
- Policy & Finance readiness
- Master & document readiness
- Exceptions by domain
- Exception register

The exception register includes severity, domain, record, customer, factual exception tags and a direct Open action. Desktop table and compact mobile cards are supported.

Domain filters:
- All exceptions
- Vehicles
- Policy & Finance
- Claims
- Customer documents

## Live smoke at implementation time

Transient organization-wide smoke values at the time of implementation were:
- 30 exception records
- 1 critical record
- 29 warning records
- 59 workflow-backlog items
- 70 missing vehicle compliance fields
- 2 expired compliance fields
- 3 compliance fields due within 30 days
- 15 AuthBridge-unverified vehicles
- 10 registration-pending vehicles
- 14 policy/finance exception records
- 2 missing PayIn cases
- 12 billing-incomplete policies
- 2 unbilled policies
- 14 pending partner payouts
- 1 claim with document exceptions
- 21 claim documents pending verification
- 0 rejected claim documents
- 0 current customer-document exception records

These values are live smoke evidence only and must never be hard-coded; production records were changing while implementation was in progress.

## Files

- `apps/web-portal/lib/reports/readiness.ts`
- `apps/web-portal/app/reports/readiness/page.tsx`
- `apps/web-portal/app/reports/export/readiness/route.ts`
- `apps/web-portal/app/reports/page.tsx`
- `apps/web-portal/app/reports/operations/page.tsx`
- `supabase/migrations/20260813090700_reporting_data_quality_readiness.sql`

## Verification and release boundary

Feature/navigation head:
- `58f95edf887344662b8d023bccfbd73533892943`

A separate already-approved production retry for PR #306 was committed immediately afterward as:
- `ba6224a3ef37c845dc095896bf6d9f77d6eeb650`

That production trigger's parent is the Readiness feature/navigation head, so its exact production snapshot includes the Readiness implementation even though no Readiness-specific deploy trigger was created.

Protected production workflow:
- `31686577222`
- full compulsory verification gate: SUCCESS
- Vercel deploy-hook job: SUCCESS

The exact gate passed Access Control V2 regressions, employee governance, release-blocker security, OCR regressions, TypeScript, lint and the Next.js production build.

The Vercel connector returned HTTP 502 when detailed deployment metadata was queried, so do not invent a Vercel deployment ID. Verify final Vercel deployment metadata later if a concrete `dpl_...` ID is required.
