# SEC-PR-04 — Policy document access compatibility review (draft only)

This change is a **pre-implementation checkpoint** for VAPT-2026-003. It does **not** change identity, capabilities, business-data scope, document permissions, RLS, Storage, signing, or existing app functionality.

## Existing behavior to preserve

- Organization-wide policy access where explicitly granted by existing business rules and effective permissions.
- RM/employee hierarchy, self scope, active per-employee scope overrides, and partner/intermediary linkage where applicable.
- Life/Health head's vertical and eligible downline access.
- Customer Portal ownership / linked-account access and existing Partner/mobile contracts.
- Policy creator actions without accidentally converting creation privileges into existing-document replace/delete privileges.
- Authorized IT and Operations exceptional workflows.

## Before an authorization-changing commit

- Obtain an approved role x operation x target-scope matrix for **view, signed URL, create, upload, replace, delete**. Document legitimate organization-wide exceptions and retention restrictions.
- Independently reconcile policy metadata RLS, Storage object policies, service-role endpoints, signed URL routes and all document writers before changing a single grant.
- Resolve how database Operations classification and UI effective permission scopes should interact; avoid removing intended broad rights.
- Obtain synthetic isolated testing authorization and test allow/deny for organization, hierarchy, self, Customer A/B, Partner branch A/B, Life/Health, create-only and admin exception actors.
- Prepare reversible SQL with precise existing-policy snapshots; never use a new permissive policy alone to narrow pre-existing permissive grants.
- Verify customer, partner, RM, Operations and mobile regression behavior, independent review, GitHub CI and rollback plan before explicit release approval.

**Status:** Business matrix owner signoff pending. No executable permission change in this PR. No production requests, migrations or deployment. Sensitive technical findings remain in the private VAPT registers, not this public application repo.

## 2026-11-13 implementation and readiness update

Draft PR #4242 now contains **server-side behavior changes**, not only the original compatibility baseline:
- `requirePolicyEditor(policyId)` combines effective edit permission and target-policy `canAccessPolicy` scope for all staff roles (including org-wide exceptions).
- Non-Motor replacement requires existing-policy editor authorization; creating the first document remains on the historical creator route pending owner review.
- `openPolicyCopy` signs only a document whose **policy** passes `canAccessPolicy`; customer-level visibility no longer substitutes for policy-specific authorization.
- Static tests were updated for Life/Health Heads to assert the shared policy-scope guard.

**Database/Storage cannot safely be declared fully remediated.** The current live SQL `public.can_access_policy(viewer_id,target_policy_id)` resolves policy visibility through customer access, not the RM-owned policy-specific server resolver; substituting it into `policy_documents` or `storage.objects` RLS would preserve cross-RM risk. Existing broad Operations `ALL` metadata/Storage policies also use a different role list than `getEmployeeAccessScope`, and employee-specific overrides exist. A separate approved SQL owner/operation scope mapping is mandatory before replacing them.

**No compatible fully enforcing RLS migration has been authored in this draft** because the exact legitimate organization, hierarchy, Partner, Customer, Life/Health and exception matrix is not yet ratified. Do not merge until all positive permissions and negative unrelated-policy checks pass in a synthetic isolated environment. Current portal app, Partner app and Customer app behavior cannot be certified from CI alone. Signed URLs can outlive permission changes until their TTL expires.

**Rollback:** code-only revert of editor, Non-Motor and signed-url checks must be reviewed against simultaneously deployed RLS changes; do not restore broad Storage/metadata policy as an automatic rollback. No deployment or live tests.
