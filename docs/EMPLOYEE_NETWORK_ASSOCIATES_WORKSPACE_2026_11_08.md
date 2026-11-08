# Employee Explorer: Partner Associates & Governed Employee Workspace (2026-11-08)

## Summary

PR #4170 adds read-only partner associate disclosure and a permission-aware employee workspace within the Organization Explorer.

### Partner relationships
- Existing source: `partner_portal_associate_accounts.intermediary_id` → `intermediaries.id`.
- Live read-only schema inspection on 2026-11-08 found 6 active accounts across 4 intermediary records, with no missing intermediary link.
- The same server scope used by the Partner Register is enforced through `getAccessibleIntermediaryIds` and visible employee IDs. Only `id`, `intermediary_id`, `name`, `designation`, `role`, and `status` are fetched for display.
- Branches and associate accounts are separate expandable relationship groups. Each is independently rendered only when records exist. Avoid confusing partner portal associates with employees reporting to the RM.
- No data mutation, new permissions, schema or RLS adjustments.

### Employee workspace
- Profile / Reporting / Network / Portal Access sections; the last tab requires `manage_users:approve`. Editing requires `manage_employees:edit`.
- The compact profile editor uses the dedicated `updateEmployeeProfile` server wrapper, which rechecks manage permission, reads the current employee code and reporting links from the database, ignores client-supplied changes to those fields, then calls the existing `updateEmployee` save action. This preserves the Directory Table's management path. Employee code, reporting manager ID, and pending manager code are locked in this workspace, pending a governed correction/reassignment workflow.
- No permanent deletion in Organization Explorer. Normal employee deactivation remains in the existing governed operation.
- The underlying employee/profile synchronization is **not** made atomic by this PR and therefore remains a known follow-up risk.

## Separate follow-up PR (not included here)

1. Investigate all existing employee/profile synchronization and employee-status governance dependencies.
2. Implement a transactionally consistent employee+linked-profile update, or an explicitly recoverable safe equivalent. Do not introduce a service-role browser endpoint. Any privileged SQL should be callable only by a trusted server path after capability checks; tightly restrict EXECUTE grants.
3. Add reporting-manager preflight: no self/descendant cycles, valid active manager, impact preview for direct reports and assigned intermediaries, explicit confirmation and audit attribution. Changing employee reporting manager must not auto-transfer business partners.
4. Add audit events with minimal changed-field metadata, actor, reason and timestamp; redact sensitive before/after fields. Store in a reviewed migration only and protect with RLS/privileged access. No backfilled synthetic history.
5. Preserve existing special admin-role and deactivation safeguards. Deactivation remains the normal offboarding path; no permanent delete button.
6. Audit migration must be reviewed and applied **before** any UI depending on it is deployed. Keep rollbacks and restore instructions. Never perform production writes without separate approval.

## Release checks

Run full `Verify web portal` including new `employee-network-associates-workspace-regression.mjs`. Perform authenticated visual QA: multiple associate accounts, no associates, branches, staff without management rights, users with portal-role rights, compact editor on desktop/mobile, and existing Table compatibility. **No merge or deployment without explicit approval.**
