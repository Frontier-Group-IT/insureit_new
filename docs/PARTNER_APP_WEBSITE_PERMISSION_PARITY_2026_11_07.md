# INSUREIT Partner App permission parity — 2026-11-07

## Requested behavior
Use the existing Operations website effective permissions for employees throughout the Partner App. A website View-only employee must never see an app Edit/Save/Create action or access it through a direct route; users without View must not see or open the feature. Keep separate partner/branch/group server-owned authorization (not internal employee administrative access).

## Code changes
- Authenticated `/api/partner/effective-permissions` reads the same `getEffectivePermissionAccessMap` used by website. Validates caller JWT, active employee profile and employment, and actor-to-profile identity. Returns private/no-store response. No client-controlled role or ID.
- Partner/branch/group users receive only an explicit existing partner-facing UI capability map, never elevated internal permissions. Existing RPC/RLS and Partner scope remain the authorizing layer.
- Partner session requests fresh permission map, never treats a network failure as permission approval. Default deny for absent capabilities.
- Tab visibility, More menu, dashboard shortcuts and deep links use shared access map. View-only employees can open records but not creation/edit routes.
- Claim stage screen uses its existing read-only fallback without `manage_claims:edit`. Claim mutation functions check live permissions before writing. Customer and Policy Intake creation check live authorization.
- Backend Policy Intake API refuses employee create/replace without website `create_policy_intakes:edit`, even for direct POST requests.
- Prepared SQL `20261107180000_partner_app_website_write_permission_guards.sql` adds an authenticated, active-employee-only write grant evaluator that respects user overrides, role overrides, and portal role defaults for the currently supported write capabilities, then protects all seven identified claim mutation RPCs including direct stage-detail insertion. The existing Partner/business scope checks remain intact. `supabase/rollbacks/20261107180000_partner_app_website_write_permission_guards_rollback.sql` restores the exact old function definitions.
- Home tab is hidden for employees without website dashboard rights; sign-in redirects those users to More rather than a blocked dashboard.
- Partner reports remain Partner-scoped but internal employees require the website `view_reports` grant for report routes.
- Changed website capabilities or employee overrides take effect after the app session is refreshed; sensitive app write paths perform a fresh permission check each time.

## Security boundaries, not claims of complete cross-product feature parity
- For the seven identified claim write RPCs, database permission guards are prepared in the migration and remain inactive until reviewed and applied. Other Partner RPCs (especially customer creation, external renewal interactions and media/storage workflows) still need independent authorization review; UI checks do not secure those APIs.
- The Partner App does not implement every website admin/accounting/reporting feature. A full-permission employee (e.g. Nishant) has the same authorization *for implemented app features*, not all website screens in a native app.
- Partner/associate role labels such as `insurance_head` are separate from internal employee capabilities. The explicit partner-facing grants preserve existing behavior subject to existing partner scope.
- The app-side intermediary data scope is distinct from website module capabilities; role-specific data-scope discrepancies (claims_head, accounts, life-head) may still need database-scope changes and independent authorized SQL review. Do not broaden data scope merely to achieve menu visibility.

## Release gates
No live SQL migrations, permission changes, portal deploy, OTA, APK/AAB/IPA. Roll out in order: reviewed SQL migration -> portal permission API deploy -> Partner production OTA. Never publish the app before the portal permission endpoint is live. Run both related PR checks, test full employee roles (IT Super User, IT User, Sales, Accounts, Claims, RM), Partner associate, Branch and Group account, authenticated deep links, revoke-access refresh, and add/edit/review attempts. Check that no employee/partner is granted business outside authorized scope. Merge or publish only after explicit approval.
