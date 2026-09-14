# Business Group Branch Onboarding Handoff

Date: 2026-09-14

## State

**IMPLEMENTED ON FEATURE BRANCH / NOT MERGED / MIGRATION NOT APPLIED / NOT DEPLOYED**

Branch: `feat/business-group-branch-onboarding`

## User requirement

The Business Groups page must support two distinct Branch workflows:

1. **Add Branch** creates a new Branch profile from a dedicated onboarding form.
2. **Assign Branch** links an existing unassigned Branch profile to a root Partner.

The Assign Branch candidate list must never use generic ungrouped Partner/POSP/MISP records.

Target hierarchy remains:

`Group → Partner → Branch`

Employee assignment remains independent and is not Group or Branch ownership.

## UI

`/intermediaries/groups`

Header actions become:

`Add Branch | Assign Branch | Create Group`

`Add Branch` opens:

`/intermediaries/groups/branches/new`

Form fields:

- Branch Name
- Phone Number
- Email
- Contact Name
- Address
- Tag to a Partner
- Save

The Partner dropdown contains eligible active root Partners in the viewer's permitted hierarchy.

## Canonical Branch marker

A new additive table, `partner_branch_profiles`, marks only records created through the dedicated Branch Onboarding flow. This avoids overloading `partners.partner_kind`, whose existing contract remains `individual | business`.

The Branch selector is now based on this explicit registry, so POSP, MISP, and ordinary Partner records are excluded.

## Database migration

Migration committed but **NOT APPLIED**:

`supabase/migrations/20260914194500_partner_branch_onboarding.sql`

It adds:

- `partner_branch_profiles`
- `service_create_partner_branch_profile(...)`
- `service_assign_registered_partner_branch(...)`
- `service_delete_empty_partner_branch_profile(...)`

The new mutation RPCs are server/service-role only.

No existing Partner, Group, Group membership, Branch relationship, or Employee assignment is backfilled or rewritten.

## Reversibility

- Existing assigned Branch relationships can still be detached through `service_remove_partner_branch`.
- A newly created Branch profile can be deleted through `service_delete_empty_partner_branch_profile` only while it has no Group membership history, child records, or downstream FK usage.
- The migration is additive; application rollback does not require destructive removal of the new table.
- Existing data is not converted automatically.

## Deployment-order safety

The Business Group page treats failure to load the additive Branch registry as a hierarchy readiness failure: the current Business Group data remains readable, but mutations are disabled until the schema is available. It does not revert to the old Employee-first Group workspace merely because the Branch registry is not present.

## Release gates before production

Before merge/deploy:

1. Canonical `Verify web portal` must pass on the exact PR head.
2. Add/confirm a protected production schema workflow for migration `20260914194500`.
3. Ensure `.github/workflows/deploy-production.yml` recognizes that migration and waits for the schema workflow.
4. Verify production pre/post invariants: Partner count except intentional later user-created Branches, Group count, active Group memberships, and existing `parent_partner_id` relationships must not be rewritten by migration application.
5. Do not merge, apply the migration, or deploy without explicit user approval.
