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
