# INSUREIT Access Control Rebuild — Phase 2 Permission Catalogue

Status: IN PROGRESS — SHADOW MODE
Date: 2026-08-10

## Safety rule
The V2 catalogue is metadata only during Phase 2. Existing live authorization continues to use the legacy capability engine, employee overrides and current RLS policies.

No employee access may change merely because a V2 permission exists.

## Source
Canonical shadow catalogue:
- `apps/web-portal/lib/access-control-catalogue-v2.ts`

The file defines:
- V2 permission keys
- permission business modules
- risk classification
- valid access levels
- valid data scopes
- whether scope is required
- compatibility mapping from every legacy `Capability`

## Access levels
V2 keeps the simple four-level model:
- none
- view
- edit
- approve

A permission definition restricts which non-none levels are valid. For example a pure view permission cannot be configured as Edit or Approve.

## Target data scopes
The shadow catalogue introduces:
- self
- assigned
- team
- hierarchy
- branch
- zone
- department
- vertical
- selected_locations
- selected_employees
- organization

Not every permission accepts every scope.

## First-pass V2 permission groups

### Dashboard
- `dashboard.view`

### Claims
- `claims.view`
- `claims.edit`
- `claims.verify_documents`
- `claims.assign_surveyor`
- `claims.change_stage`

Reason for split: legacy `manage_claims` currently covers materially different operational and privileged actions.

### Intermediaries
- `intermediaries.view`
- `intermediaries.application.create`
- `intermediaries.application.review`
- `intermediaries.application.approve`
- `intermediaries.activate`
- `intermediaries.portal_users.manage`
- `intermediaries.training.manage`
- `intermediaries.agreement.manage`
- `intermediaries.iib.manage`
- `intermediaries.delete`

Reason for split: current scoped intermediary-management access is reused by onboarding, training/integration workflow and other stages, while deletion is protected separately by system-administrator access.

### Customers
- `customers.view`
- `customers.create`
- `customers.edit`

### KYC
- `kyc.view`
- `kyc.review`
- `kyc.approve`

KYC approval exists in the target catalogue even though current legacy `review_kyc` maps only to V2 review during compatibility mode. Phase 3 must decide which roles receive final approval.

### Employees and organisation
- `employees.view`
- `employees.create`
- `employees.edit`
- `employees.deactivate`
- `organisation.view`

Employee HR/organisation administration remains distinct from portal/security administration.

### Fleet
- `vehicles.view`
- `vehicles.create`
- `vehicles.edit`

### Policies
- `policies.view`
- `policies.create`
- `policies.edit`

This split also removes the current ambiguity where Add Vehicle/Add Policy UI can ask for Edit on a legacy `view_*` permission whose default access level is only View.

### Tasks
- `tasks.view`
- `tasks.create`
- `tasks.assign`
- `tasks.edit`

### Reports and notifications
- `reports.view`
- `notifications.view`

### Administration
- `admin.portal_users.manage`
- `admin.roles.manage`
- `admin.permissions.manage`
- `admin.audit.view`

### Master data and system
- `master_data.manage`
- `system.manage`
- `system.integrations.configure`

## Compatibility mapping principles
Every legacy capability maps to one or more V2 permissions. The compatibility map documents what the legacy capability effectively represents today; it does not define the final role matrix.

Examples:
- legacy `manage_claims` -> claim edit + document verification + surveyor assignment + stage change
- legacy `manage_employees` -> employee create + edit + deactivate
- legacy `manage_tasks` -> task create + assign + edit
- legacy `manage_system` -> role/permission administration + access audit + destructive intermediary deletion + system/integration configuration

The compatibility map intentionally exposes broad legacy semantics so Phase 3 can review them rather than silently carrying them forward.

## Important compatibility caveats

### Intermediary workflow
Today `requireScopedPospMispManager()` grants access when the user has either create or review intermediary capability. Several training/agreement/IIB actions use that helper.

For shadow parity, both legacy create and legacy review map to those workflow permissions. Phase 3 should narrow this deliberately by role rather than treating the compatibility map as the final policy.

### KYC
Legacy `review_kyc` maps to `kyc.review`, not `kyc.approve`. Final approval authority must be assigned explicitly in the role matrix.

### Fleet and Policies
Legacy code exposes only `view_vehicles` and `view_policies` capabilities, while some navigation links request Edit access on those same view capabilities. V2 therefore introduces explicit create/edit permissions so write authority can be represented correctly.

### User management
Legacy `manage_users` maps only to employee portal-user administration. Role and permission configuration remain under legacy `manage_system` during compatibility mode because that is how the current Access Control page is protected.

## Phase 2 remaining work
1. Validate the V2 catalogue compiles without affecting runtime.
2. Add catalogue integrity tests:
   - unique permission keys
   - valid allowed-access combinations
   - valid scopes
   - every legacy capability has a compatibility mapping
   - no compatibility mapping points to a missing V2 permission
3. Build a shadow legacy-role -> V2 permission expansion report.
4. Compare navigation/action needs against the V2 catalogue and identify missing permission keys.
5. Freeze the Phase 2 catalogue before Phase 3 role design.

## Phase 2 exit gate
Phase 2 is complete only when:
- the V2 catalogue is internally valid
- all legacy capabilities are mapped
- all known privileged actions have a V2 permission home
- no live authorization behavior has changed
- the catalogue is stable enough to build the target role matrix in Phase 3
