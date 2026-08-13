# Governance Reporting Handoff

> Updated: 2026-08-13 IST
>
> Read with `AGENTS.md`, `docs/INSUREIT_PROJECT_CONTEXT.md`, `docs/CURRENT_CHAT_HANDOFF.md`, `docs/REPORTS_IMPLEMENTATION_HANDOFF.md`, and `docs/OPERATIONS_REPORTING_HANDOFF.md` before continuing Reports work.

## Phase

Reports Governance phase is implemented on `main` and the reporting RPC is applied to the existing production Supabase project. Web deployment remains gated by explicit user approval.

## Route and authorization

Route: `/reports/governance`.

Governance is intentionally stricter than ordinary Reports. The page requires effective `manage_users` capability, not just `view_reports`, because it exposes organization-wide permission changes, overrides, role/account distribution and audit activity. Do not weaken this to `view_reports` without an explicit product/security decision.

## UI

The Governance workspace is data-first and contains:

- period filters: Last 30 days, Last 90 days, YTD, All time, custom;
- audit action filter;
- KPIs: Profiles, Active, Inactive, Employee overrides, Permission changes, Audit events;
- role distribution;
- active override mix;
- active employee override table;
- permission change history;
- paginated audit activity register.

Sensitive audit payloads are intentionally excluded from the reporting contract. The report does not expose `audit_logs.old_data`, `audit_logs.new_data`, IP addresses or user-agent values.

## Backend

Live Supabase migration name: `governance_reporting`.

Repository replay file:

`supabase/migrations/20260813072700_governance_reporting.sql`

Function:

`public.get_governance_report(date,date,text,integer,integer)`

Security:

- `SECURITY DEFINER`;
- fixed `search_path=public`;
- execute revoked from `PUBLIC`, `anon`, and `authenticated`;
- live ACL inspection confirms only `postgres` and `service_role` execute access.

Primary sources:

- `profiles`;
- `employee_permission_overrides`;
- `role_permission_overrides`;
- `permission_change_logs`;
- `audit_logs`.

Live 30-day smoke at implementation time returned 19 profiles, 17 active, 2 inactive, 14 active employee overrides, 0 role overrides, 29 permission changes, and 24 audit events. These are transient live values and must never be hard-coded.

## Files

- `apps/web-portal/lib/reports/governance.ts`
- `apps/web-portal/app/reports/governance/page.tsx`
- `supabase/migrations/20260813072700_governance_reporting.sql`

## Release boundary

Do not update `.deploy/production-trigger.json` unless the user explicitly requests deployment. The Governance reporting database function is already present in the existing Supabase project, but the web workspace should be treated as not intentionally deployed until a protected production release includes it.

## Next phase

After Governance is trusted, the remaining reporting milestone is a Month-End Management Pack built only from already-verified component reports. Do not invent management-pack metrics that are not supported by Business, Distribution, Renewals, Claims, Finance, Operations, or Governance source data.
