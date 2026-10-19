# Claims Head least-privilege implementation handoff (2026-10-19)

Status: PARTIAL DRAFT. No deployment, migration, production permission modification, or merge authorized.

## Reviewed
- `apps/web-portal/lib/roles.ts`: seven legacy capabilities: dashboard, claims view/edit, tasks view/manage, reports view, notifications.
- `apps/web-portal/lib/employee-access-scope.ts`: Claims Head was omitted from organization-wide scope, falling back to self. Claims and reports used this scope.
- `apps/web-portal/lib/permission-management.ts`: effective authority precedence is employee override > role override > default.
- `apps/web-portal/lib/access-control-role-matrix-v2.ts`: target claims-specific granular model is shadow-only according to Phase 5 docs.
- `apps/web-portal/middleware.ts`: no Claims Head-specific module boundary.

## Changes made on this branch
1. Added claims_head to organization-wide scope resolution. This widens claim record visibility to the intended departmental organization level and must be reviewed carefully before cutover.
2. Introduced Claims Head-specific middleware navigation restriction, permitting only Claims, Claim Documents, Claims Reports/export, Tasks, Notifications, Dashboard, and Access Denied.
3. Redirects Claims Head at root/login and on blocked protected portal routes to /claims.

## Production verification blocker
Connected Supabase accounts exposed projects `ilzhsfqqjyppzzvfscmh` (has role/permission tables, but query returned zero Claims Head rows) and `ubkwtjyvbdvepzbxoikq` (does not expose a public.profiles table). Neither has been confirmed as INSUREIT production. Do NOT infer actual account grants or run an authorization migration there without establishing the production project URL safely.

## Not yet solved — do not merge this draft as a completed security rollout
- `/tasks` remains a general tasks workspace, not claim-only. Must ensure records/actions belong to accessible claims.
- `/dashboard` is still a shared dashboard; requires claims-specific composition and data restrictions.
- `/reports/export/claims` and `/reports/claims` need end-to-end authorization tests. Report scope currently uses view_reports.
- Central role / employee overrides may grant non-claims capabilities. Route restriction is not a replacement for server authorization.
- Granular claims approval, document verification, surveyor assignment and financial settlement permissions are not yet live V2 authorization. Needs parity reviewed rollout.
- Supabase RLS helpers and direct API endpoints need audit and deny tests for non-claims data; no production migrations have been made.
- Confirm production Claims Head user and all overrides; verify no other role regression.
- Run typecheck, lint, security tests, and browser smoke tests before merging.

## Rollback
Revert branch commits or close draft PR. No database rollback required for current changes.
