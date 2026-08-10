# INSUREIT Access Control Rebuild — Phase 1 Authorization Audit

Status: COMPLETE
Date: 2026-08-10

## Safety outcome
Phase 1 made no production authorization changes. No employee role, portal account, permission override, role override, RLS policy, Auth user, or scope rule was changed.

## Current authorization layers
INSUREIT currently has three authorization layers running in parallel:

1. Application capability checks
   - `apps/web-portal/lib/roles.ts`
   - `apps/web-portal/lib/permission-management.ts`
   - `apps/web-portal/lib/effective-permissions.ts`

2. Application record-scope helpers
   - `apps/web-portal/lib/employee-access-scope.ts`
   - customer/intermediary scoped helper functions in `apps/web-portal/lib/master-data-server.ts`

3. Supabase/Postgres RLS and security-definer functions
   - role-name based RLS policies
   - `current_app_role()`
   - `can_access_customer(...)`
   - `can_access_claim(...)`
   - `can_access_full_business_data()`
   - `can_access_intermediary_owner(...)`
   - `can_access_profile(...)`
   - `can_manage_employees()`
   - `can_manage_sales_records()`
   - `can_manage_users()`
   - `can_update_claim_status()`
   - `can_view_employee_record(...)`
   - `get_user_downline(...)`

The rebuild must converge these into one explainable policy model while retaining RLS as a defence-in-depth enforcement layer.

## Identity and employee lifecycle
Current identity chain:

Employee record -> Supabase Auth user -> `profiles` portal identity -> one `profiles.role`

Important current behaviour:
- An employee can exist without portal access.
- Portal access can be created during employee onboarding or invited later.
- Employee deactivation sets `employees.employment_status = inactive` and linked `profiles.is_active = false`.
- Auth ban/suspension state is not a first-class access-control lifecycle state.
- Invitation pending/accepted, last sign-in, suspension, restoration and offboarding are not modelled as first-class portal states in the current Access Control workspace.
- Employee creation and later invite use slightly different internal-role validation; the rebuild needs one canonical staff-role validator.

## Current role model
Role defaults are primarily hard-coded in `apps/web-portal/lib/roles.ts`.

Internal roles currently include:
- Super Admin
- Admin
- Manager
- Claims Head
- Operations Head
- Backoffice Executive
- Claim Processor
- Field Executive
- Relationship Manager
- Director
- Sales Head
- Zonal Head
- Area Sales Head
- Sales Manager
- Agent
- IT Super User

External roles `customer` and `intermediary` must stay outside employee-role administration.

Production usage snapshot during audit:
- Relationship Manager: 6 active users
- Sales Head: 3
- Super Admin: 2
- Area Sales Head: 2
- Director: 1
- IT Super User: 1
- Operations Head: 1

This is diagnostic data only, not a target role catalogue.

## Current permission model
The current TypeScript catalogue has 24 capabilities and four access levels:
- none
- view
- edit
- approve

Current TypeScript effective-access precedence:
1. protected IT Super User
2. active employee override
3. role-level database override
4. hard-coded role default

Production snapshot:
- 8 employee override rows
- 3 employees with custom overrides
- 0 role override rows

The `role_permission_overrides` table therefore exists but is not yet functioning as a real role-administration source of truth.

## Current scope model
Current application scope values:
- inherit
- self
- hierarchy
- organization

`employee-access-scope.ts` currently:
- hard-codes organisation-wide roles
- hard-codes hierarchy roles
- defaults other internal roles to self
- reads employee-level scope overrides
- does not read role-level scope overrides
- walks `employees.reporting_manager_id`

Important mismatch: access-level resolution honours role overrides, while scope resolution ignores role-level scope overrides. Effective access and effective scope can therefore diverge.

Database `get_user_downline()` instead walks `profiles.reporting_manager_id`. The employee and profile reporting trees must be reconciled before the target system chooses one hierarchy source.

## Module-by-module findings

### Customers
Customer Register is the strongest current application pattern:
- explicit `view_customers` capability check
- explicit `getAccessibleCustomerIds(...)`
- service-role query filtered by returned accessible IDs

Customer RLS also independently enforces customer hierarchy/membership rules.

Target: preserve this defence-in-depth pattern but derive both app filtering and RLS from the same policy source.

### Customer KYC
`/customer-kyc` requires `review_kyc` at edit level, then queries onboarding applications with the Supabase admin client.

Finding: KYC capability is checked, but the page does not apply the shared customer/employee record-scope helper to the admin-client result set.

Target: KYC must get explicit view/review/approve permissions plus an enforced data scope.

### Intermediatory
Intermediary application access already has scoped helpers through `requireScopedPospMispManager(...)` / `canAccessIntermediaryApplication(...)`.

However, current privileged operations are bundled under broad access:
- linked POSP/MISP account creation uses scoped intermediary-management access
- training/iCall actions use scoped intermediary-management access
- agreement/training/IIB stages are not represented as separate administrative permissions
- permanent account deletion requires scoped intermediary access plus `manage_system: approve`

Target: split ordinary onboarding management from activation, portal-user administration, external training integration, and destructive account deletion.

### Claims
Claims pages use authenticated Supabase queries and rely heavily on RLS for row visibility.

Current server actions commonly require `manage_claims: edit` for materially different operations, including:
- claim document verification
- surveyor deputation
- workflow/stage updates

Postgres separately uses `can_update_claim_status()` with hard-coded roles.

Target: split claim view/edit, document verification, assignment/survey, workflow transition and privileged/final approval actions while retaining claim/customer scope enforcement.

### Tasks
Task register relies on authenticated Supabase queries and RLS. Task visibility can be granted through assignment, claim access and customer access.

Target: distinguish task view, create/assign, edit/close, and scope by assigned/team/hierarchy as appropriate.

### Fleet and Policies
RLS constrains reads through accessible customer relationships and constrains writes through customer access plus hard-coded `can_manage_sales_records()` role groups.

Target: explicit vehicle/policy create/edit permissions plus the same customer/fleet data-scope resolver used by application and RLS.

### Employees and portal users
Application actions distinguish:
- `manage_employees: edit` for employee records
- `manage_users: approve` for portal invitations

Database RLS separately hard-codes employee/user management to Super Admin, Admin and IT Super User.

Known mismatch: the generic TypeScript `manager` role currently receives `manage_employees`, but Postgres `can_manage_employees()` does not permit Manager.

Target: employee administration and portal-user/security administration remain separate permissions with consistent app + RLS enforcement.

### Master data
Vehicle manufacturer writes require `manage_master_data: edit` in the server action and then use the admin client/RPC.

Target: retain an explicit master-data permission, but separate general master-data editing from system/integration administration.

### Integrations
Operational iCall training actions currently inherit intermediary-management authorization rather than having a dedicated integration permission.

Target: normal business users may use approved workflow integrations only when required by their business permission; configuration/UAT/provider administration remains a separate protected technical permission.

## Navigation findings
Navigation is a presentation layer only. Menu visibility is generated from the effective permission access map and cannot be treated as a security boundary.

All sensitive routes/actions must remain protected server-side and/or by RLS even when hidden from navigation.

## Critical TypeScript/Postgres mismatches

1. `current_app_role()` can read JWT/app/user metadata before `profiles.role`. Role identity can disagree between application and RLS if Auth claims are stale or inconsistent.
2. `manager` has broad TypeScript capabilities but is not accepted by several Postgres management functions.
3. `can_access_full_business_data()` grants broad database treatment to roles including Claim Processor and Field Executive, wider than the target scoped model.
4. `can_manage_sales_records()` is a hard-coded role list and ignores capability overrides.
5. `can_update_claim_status()` is a separate hard-coded claim role list and does not mirror TypeScript `manage_claims` exactly.
6. `can_access_intermediary_owner()` has another independent role grouping.
7. App scope walks employee reporting hierarchy; database downline walks profile reporting hierarchy.
8. RLS policies are permissive/cumulative, so effective access is the OR of applicable policies, not any one policy in isolation.

## Privileged-action classes identified
The target catalogue must explicitly represent at least these classes:
- employee record administration
- portal user invite/activate/suspend/restore
- role assignment
- role permission administration
- employee permission override administration
- audit-log access
- intermediary application review
- intermediary approval
- intermediary activation
- intermediary portal-user administration
- destructive intermediary deletion
- external training/integration workflow actions
- KYC review/approval
- claim edit
- claim document verification
- claim assignment/survey
- claim workflow transition
- task assignment/management
- vehicle/policy writes
- master-data administration
- system/integration administration

## Phase 1 exit decision
Phase 1 is complete.

We have enough evidence to design the target permission catalogue without changing current production access. The key migration constraint is that the new catalogue must first run in compatibility/shadow mode and reproduce current effective access before any route, action or RLS policy is switched to it.

## Phase 2 entry rule
Phase 2 may add permission-catalogue metadata, compatibility mappings and tests, but must not yet change live effective permissions.
