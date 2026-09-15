# Group / Branch Portal Access Hardening Handoff

## State

- IMPLEMENTED: YES, on `fix/group-branch-access-hardening`
- MERGED: NO
- PRODUCTION SCHEMA APPLIED: NO
- DEPLOYED: NO
- PRODUCTION VERIFIED: NO

Do not treat the corrective migration as production-applied until the protected schema workflow succeeds after an explicitly approved merge.

## Why this correction exists

PR #1827 introduced explicit Group and Branch portal credentials, but review identified three compatibility/security gaps:

1. Policy Intake assumed every `intermediary` actor had a legacy `intermediary_portal_accounts` submitter.
2. Legacy Branch Partner logins lost Group inheritance through their parent/root Partner in the replacement commercial-scope function.
3. Scope-only RPCs could rely on an active access mapping without consistently revalidating the profile and current Group/Branch activity state.

## Corrected contract

### Group login

- Authenticates through Supabase Auth.
- `portal_access_identities.entity_type = 'group'` maps the profile to the Group.
- Access context is valid only while mapping + profile + Group are active.
- Commercial scope includes active member Partners and their active Branches.
- Policy Intake uses the Group auth profile as the submitter and requires the selected lead source to be inside the resolved intermediary scope.

### Partner login

- Existing `intermediary_portal_accounts` authentication remains unchanged.
- Policy Intake continues using `submitted_by_portal_account_id` / `uploaded_by_portal_account_id`.
- Commercial scope preserves the pre-feature Partner/Employee fallback.
- A Branch Partner login resolves Group IDs through `coalesce(parent_partner_id, id)` so it inherits its root Partner's Group metadata/schemes without gaining sibling Partner scope.

### Branch login

- Authenticates through Supabase Auth.
- `portal_access_identities.entity_type = 'branch'` maps the profile to the Branch Partner record.
- Access context is valid only while mapping + profile + Branch Partner + Branch profile are active.
- Partner scope contains only that Branch Partner record.
- Group IDs are inherited only through the parent/root Partner for Group metadata/scheme compatibility.
- Policy Intake uses the Branch auth profile as the submitter and only allows lead sources present in the Branch's resolved intermediary scope.

## Files

- `supabase/migrations/20260915143000_group_branch_access_hardening.sql`
- `supabase/verification/20260915143000_group_branch_access_hardening_verify.sql`
- `supabase/rollbacks/20260915143000_group_branch_access_hardening.sql`
- `apps/web-portal/app/api/partner/policy-intakes/route.ts`
- `.github/workflows/apply-group-branch-portal-access.yml`
- `.github/workflows/deploy-production.yml`

## Reversibility

The corrective migration does not alter or delete Group, Partner, Branch, membership, Partner credential, Policy, Customer, Claim, or Renewal rows. The rollback restores the pre-hardening Group/Branch access functions while preserving the original feature and all provisioned Auth users/mappings.

## Production sequence

1. Canonical `Verify web portal` must succeed for the exact PR head.
2. Merge only with explicit approval.
3. `Apply Group Branch Portal Access` applies only missing migration versions and verifies business counts are unchanged.
4. `Deploy production to Vercel` waits for that schema workflow and verifies schema parity before invoking Vercel.
5. Production smoke test should cover one Group login, one existing Partner login, and one Branch login, including Policy Intake source selection and submission ownership.
