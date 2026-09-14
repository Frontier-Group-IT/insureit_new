# Business Group Hierarchy Handoff

> **Created:** 2026-09-14 (IST)
>
> This document records the user-approved intermediary business hierarchy and the safe transition plan. It is intentionally explicit about repository implementation versus database application versus production deployment.

## Required business model

The canonical business hierarchy is:

```text
Group
  -> Partner
    -> Branch
```

Employee assignment is **not** Group ownership. Every intermediary continues to use the existing employee-assignment workflow independently.

```text
Group -> Partner -> Branch
          |
          +-> existing Employee assignment remains independent
```

Do not reintroduce `Employee -> Group -> Partner` as the business hierarchy.

## Safety requirement

The production website is live and currently working. Group-hierarchy changes must be backward compatible and reversible. Never rewrite or delete current Group IDs, memberships, Partner records, policy Group snapshots, or intermediary employee assignments merely to activate this model.

The transition is additive first:

1. preserve all existing Groups and memberships;
2. mark current Groups as `legacy_employee` by default;
3. introduce employee-independent `business` Groups in parallel;
4. explicitly convert an existing Group in place only when an authorized operator chooses to do so;
5. preserve the Group ID and active Partner memberships during conversion;
6. keep intermediary Employee assignment untouched;
7. make Branch an optional parent relationship between existing Partner records rather than recreating Partner profiles.

## Feature implementation state

Feature branch:

```text
feature/group-partner-branch-hierarchy
```

Base `main` at implementation start:

```text
db51176d08a31fbaee3c57fc359388cd27570073
```

State at creation of this handoff:

- application implementation: **IMPLEMENTED ON FEATURE BRANCH**
- database migrations: **COMMITTED / NOT APPLIED**
- pull request: **NOT YET MERGED**
- production deployment: **NOT DEPLOYED**
- existing production data: **UNCHANGED BY THIS FEATURE WORK**

Never report the new hierarchy as live until both the migration and exact application release are separately applied/deployed and verified.

## Schema transition

Migration:

```text
supabase/migrations/20260914183000_business_group_partner_branch_hierarchy.sql
```

Adds:

- `intermediary_groups.group_mode`
  - `legacy_employee`
  - `business`
- nullable `intermediary_groups.owner_employee_id`
  - required for `legacy_employee`
  - must be null for `business`
- `partners.parent_partner_id`
  - nullable self-reference
  - root Partner has null
  - Branch points to its root Partner

Existing rows default to `legacy_employee`; there is no automatic conversion or backfill.

The active Group membership remains on the root Partner. Branches inherit Group membership through their parent Partner rather than creating duplicate Group membership rows.

## Compatibility behavior

Legacy Groups preserve the historical behavior until explicitly converted:

- employee owner remains required;
- membership continues to require Partner/Group employee-owner alignment;
- employee reassignment can still close legacy Group membership.

Business Groups change only the Group relationship semantics:

- no employee owner;
- active root Partner can be assigned independently of its employee;
- changing intermediary Employee assignment does not close business Group membership;
- Branch cannot have a direct Group membership; it inherits the parent Partner Group.

Policy Group snapshot resolution is extended so a Branch resolves the root Partner before looking up Group membership. Existing root Partners follow the same path as before.

## UI transition

`/intermediaries/groups` is changed to a Group-centric workspace:

```text
Group
  -> Partner
    -> Branch
```

The page intentionally keeps a schema-compatibility fallback. If the new database columns are not present yet, it falls back to the old SELECT shape, marks the hierarchy unavailable for mutation, and remains read-only rather than crashing.

Legacy Groups display a `Legacy employee-linked` badge and require an explicit `Convert safely` action. There is no bulk conversion.

## Reversibility

A second migration adds the audited rollback helper:

```text
supabase/migrations/20260914183100_business_group_hierarchy_rollback_rpc.sql
```

RPC:

```text
service_revert_business_intermediary_group_to_legacy(...)
```

Safe rollback after business data exists:

1. detach Branch relationships with `service_remove_partner_branch` where required;
2. choose an active employee who already owns every current Group Partner through the existing intermediary assignment system;
3. call the audited revert RPC for the Group;
4. the Group returns to `legacy_employee` without changing Partner/intermediary employee assignments;
5. application code can then be reverted independently.

Do **not** use destructive schema rollback as the normal recovery path. Keeping additive nullable columns is safer than dropping columns while live dependencies may exist.

## Production activation gates

Before merge or database application:

- canonical `Verify web portal` PR workflow must be green;
- review the exact migration diff;
- verify no automatic legacy data conversion occurs;
- verify existing Group IDs/memberships are untouched;
- verify Employee assignment behavior for legacy Groups remains unchanged;
- verify Business Group employee reassignment does not close membership;
- verify Branch cannot become a nested Branch or direct Group member;
- verify policy snapshot resolution for root Partner and Branch paths;
- verify Partner App/reporting consumers continue accepting the existing Group IDs/membership tables.

Applying migrations, merging the PR, and deploying production each require their own evidence. Do not collapse those states.
