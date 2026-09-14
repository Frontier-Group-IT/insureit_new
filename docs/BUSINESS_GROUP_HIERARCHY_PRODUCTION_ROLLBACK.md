# Business Group hierarchy production rollback

Status: production release runbook.

Target hierarchy: `Group -> Partner -> Branch`.

## Reversibility model

The production schema rollout is intentionally additive. Existing Group IDs, memberships, Partner records and intermediary employee assignments are not deleted or bulk rewritten. Existing Groups remain `legacy_employee` unless explicitly converted.

Rollback therefore prefers logical reversal over destructive schema removal:

1. Stop creating/converting Business Groups.
2. Detach any Branch relationships with the audited `service_remove_partner_branch(branch_partner_id, actor_profile_id)` RPC.
3. Revert each converted Business Group with the audited `service_revert_business_intermediary_group_to_legacy(group_id, legacy_owner_employee_id, actor_profile_id, reason)` RPC. The RPC refuses unsafe reversal when the active members do not match the selected active employee.
4. Revert/redeploy the application to the pre-Business-Group release if required.
5. Leave the additive `group_mode` and `parent_partner_id` columns in place unless a separately reviewed cleanup migration is approved. Keeping unused additive columns is safer than destructive DDL on a live site.

## Safety invariants

Before any rollback is considered complete:

- No Partner that should be independent remains with `parent_partner_id` populated.
- No Group intended to return to the old workflow remains in `group_mode = 'business'`.
- Every reverted legacy Group has a non-null valid `owner_employee_id`.
- Existing intermediary-to-employee assignments are not rewritten by the rollback.
- Existing Group and membership identifiers remain unchanged.

## Schema rollout failure

If the production schema workflow fails before the final readiness migration completes, do not deploy the new Business Group UI. The production application remains on the previously working release. Fix the failing migration on a new branch/PR, rerun verification, and resume only after the schema workflow is green.

## Destructive schema removal

Dropping the new columns/functions is not the normal rollback mechanism. A physical down-migration may only be prepared after the logical rollback above is complete and a read-only production check confirms there are zero Business Groups and zero Branch relationships. This prevents loss of hierarchy data.
