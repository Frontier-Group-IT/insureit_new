# INSUREIT Access Control Rebuild Plan

Status: Phase 1 in progress
Date: 2026-08-10

## Objective
Rebuild employee access management into a robust role-based and scoped authorization system covering employee lifecycle, portal identity, role assignment, role defaults, employee-specific overrides, data scope, privileged access, audit and access review.

## Current architecture audit

### Identity layers
1. `employees` is the HR/organisation record. It stores employee code, name, phone/email, department, designation, vertical, location, reporting manager and employment status.
2. Supabase Auth is the authentication identity.
3. `profiles` is the portal identity and currently stores one `role` plus `employee_id` linkage and active state.
4. Employee existence and portal access are separate concepts, but the current UI does not expose that distinction strongly enough.

### Current employee/portal lifecycle behaviour
`apps/web-portal/app/employees/actions.ts` currently handles employee creation, employee updates, invitations and active/inactive synchronization.

Observed behaviour:
- Employee creation requires employee code, name, department and designation.
- Portal access is optional at employee creation.
- Creating portal access immediately sends a Supabase Auth invitation and then upserts a `profiles` row.
- If Auth invitation fails during create-with-access, the newly created employee row is deleted.
- If profile creation fails after Auth invitation, the invited Auth user and newly created employee row are deleted.
- Updating employee identity fields synchronizes the linked profile fields.
- Setting an employee inactive sets `employees.employment_status = inactive` and linked `profiles.is_active = false`.
- Reactivating reverses the profile active flag.
- Auth-user suspension/ban state is not currently modeled as a separate lifecycle state by these actions.
- Portal invitation status, acceptance date, last sign-in, suspension and explicit offboarding are not first-class employee-access states in this workflow.

Audit inconsistency to resolve in Phase 2/6:
- `createEmployee` rejects `customer` as an internal portal role but does not explicitly reject `intermediary`.
- `sendEmployeePortalInvite` correctly rejects both `customer` and `intermediary`.
This should be unified behind one canonical internal-role validator.

### Current role model
The application currently defines portal roles in `apps/web-portal/lib/roles.ts`. Role capability defaults are code-defined through `roleCapabilities`.

Current internal roles include:
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

Customer and Intermediary are external portal roles and should stay outside the employee-role administration catalogue.

### Current permission model
`apps/web-portal/lib/permission-management.ts` defines 24 capabilities and maps them to access levels:
- none
- view
- edit
- approve

Capabilities are grouped by business module and classified by risk.

Current TypeScript resolution order is:
1. protected IT Super User behaviour
2. active employee-specific override
3. role-level database override
4. code-defined role default

### Current scope model
Current stored scope values are:
- inherit
- self
- hierarchy
- organization

The UI presents these as Own records, Reporting hierarchy and Entire organisation.

A shared helper already exists at `apps/web-portal/lib/employee-access-scope.ts`. This is an important foundation and means the rebuild does not start from zero.

Current scope-helper behaviour:
- hard-codes organisation-wide roles: Super Admin, Admin, IT Super User, Manager, Director, Operations Head and Backoffice Executive.
- hard-codes hierarchy roles: Sales Head, Zonal Head, Area Sales Head and Sales Manager.
- defaults other internal roles to self scope.
- supports active employee-specific scope override for a capability.
- resolves reporting descendants from `employees.reporting_manager_id`.
- resolves linked profile IDs for those employees.
- provides customer, intermediary application, intermediary, import-batch and employee/profile scope helpers.

Important Phase 1 findings:
1. The scope helper uses hard-coded role categories instead of the role permission configuration.
2. It reads `employee_permission_overrides.scope_type` but does not consult `role_permission_overrides.scope_type`, even though effective permission access does consult role overrides.
3. Therefore access-level resolution and scope resolution can diverge.
4. Scope modes are limited to organization / hierarchy / self / none.
5. Customer and intermediary modules already have a path toward centralized scoping, but other modules must be audited individually.

### Confirmed module-scope observations

#### Customers
`apps/web-portal/app/customers/page.tsx` explicitly requires `view_customers`, calls `getAccessibleCustomerIds(profile.id, profile.role)`, and filters the service-role customer query by those IDs. This is the current best example of capability + scoped record access working together.

#### Claims
`apps/web-portal/app/claims/page.tsx` currently queries claims through the authenticated server Supabase client and does not call the central effective-permission/scope helpers in the page itself. Its row visibility is therefore primarily constrained by database RLS functions/policies.

#### Tasks
`apps/web-portal/app/tasks/page.tsx` similarly queries `claim_tasks` through the authenticated server client without an explicit central scope decision in the page. RLS applies claim/customer-based visibility and assignment checks.

#### Vehicles and Policies
RLS policies constrain reads through customer access and constrain writes through customer access plus sales-management functions. These rules are role-name driven inside Postgres rather than derived from the TypeScript permission engine.

#### Employees and Profiles
RLS protects employee/profile reads and writes through database functions such as `can_view_employee_record`, `can_manage_employees`, `can_access_profile` and `can_manage_users`.

#### Intermediatories
RLS uses `can_access_intermediary_owner` / `can_access_intermediary_application`, again based on hard-coded role groups and downline membership.

These findings confirm that authorization is presently mixed across application-level capability checks, application-level scoped ID filtering and database RLS. Phase 5/9 must unify the decision model without weakening existing RLS protections.

### Database authorization function audit
The production database contains an additional hard-coded role model in security-definer functions used by RLS. This means changing `roles.ts` alone is not sufficient to change real access safely.

Critical findings:

1. **Role source can disagree.** `current_app_role()` prefers JWT `app_role` / app metadata / user metadata before falling back to `profiles.role`. A profile-role update can therefore temporarily or persistently disagree with RLS if Auth metadata/token claims are stale or inconsistent.

2. **Employee-management mismatch.** TypeScript currently gives the generic `manager` role all operational capabilities, including `manage_employees`, but database `can_manage_employees()` only permits Super Admin, Admin and IT Super User. The application layer can therefore say an action is allowed while RLS rejects the write.

3. **User-management is separately hard-coded.** `can_manage_users()` also permits only Super Admin, Admin and IT Super User, independently of `role_permission_overrides` or employee overrides.

4. **Business-data scope is broader in Postgres than the TypeScript scope helper.** `can_access_full_business_data()` currently includes Super Admin, Admin, IT Super User, Director, Manager, Backoffice Executive, Claim Processor and Field Executive. In particular, Claim Processor and Field Executive receive full-business-data treatment in this database helper even though the target model should normally constrain them to claims/assigned work.

5. **Sales write authority is role-name driven.** `can_manage_sales_records()` contains a fixed list of Operations Head, Backoffice Executive, Sales Head, Zonal Head, Area Sales Head, Sales Manager and Agent. It does not consult capability overrides.

6. **Claim update rules are separately hard-coded.** `can_update_claim_status()` currently names only Manager and Claim Processor. This does not directly mirror TypeScript `manage_claims` capability assignments.

7. **Profile visibility has its own hierarchy model.** `can_access_profile()` and `can_view_employee_record()` contain special-case role logic for administrators, Director, Operations/Backoffice and sales hierarchy roles.

8. **Intermediary visibility has another role grouping.** `can_access_intermediary_owner()` directly names administrative/operations roles and otherwise uses `get_user_downline()`.

9. **Downline source differs from the TypeScript helper.** Database `get_user_downline()` walks `profiles.reporting_manager_id`, while `employee-access-scope.ts` walks `employees.reporting_manager_id` and then resolves profiles. Both trees must be proven synchronized before the new model relies on one canonical hierarchy source.

10. **RLS policies are permissive and cumulative.** Multiple policies can apply to the same table. The rebuild must evaluate the effective OR-combination of policies rather than interpreting any single policy in isolation.

### Current override and audit model
Existing database tables already provide useful foundations:
- `employee_permission_overrides`
- `role_permission_overrides`
- `permission_change_logs`

Production snapshot during Phase 1 audit:
- 8 employee override rows
- 3 employees with custom overrides
- 0 role override rows

This confirms that employee exceptions are already used, while role administration is not yet actually managed through the database/UI.

### Current active internal role usage
Production snapshot during Phase 1 audit:
- Relationship Manager: 6
- Sales Head: 3
- Super Admin: 2
- Area Sales Head: 2
- Director: 1
- IT Super User: 1
- Operations Head: 1

This snapshot is diagnostic only and must not be treated as a permanent role catalogue.

## Key deficiencies to fix

1. Role defaults are primarily hard-coded and require a code deployment to change.
2. A second hard-coded role model exists in Postgres RLS helper functions.
3. The role-level override table exists but has no complete role-management UI/workflow.
4. `profiles.role` supports only one role per employee.
5. Designation and security role are conceptually too easy to confuse.
6. Access-level resolution and scope resolution are separate and can diverge.
7. Scope defaults are hard-coded by role instead of being derived from the same role-permission source of truth.
8. JWT role metadata and `profiles.role` can disagree.
9. Employees and profiles contain parallel reporting-manager relationships that must be reconciled.
10. Several capabilities are too broad for long-term administration.
11. Access Control is employee-exception oriented rather than full user governance.
12. Portal lifecycle states such as no access, invited, active, suspended and disabled are not first-class in the access workspace.
13. There is no dedicated role editor, permission catalogue, access-review workspace or comprehensive security timeline.
14. Generic roles such as `manager` require business review before being retained as security roles.
15. Internal-role validation is inconsistent between employee creation and later invitation.
16. Current authorization is split between app permission checks, app scope filters and RLS; this needs one documented policy and one explainable resolver.

## Target authorization model

Employee -> Portal Identity -> Role Assignment(s) -> Role Permissions -> Employee Exceptions -> Data Scope -> Effective Access Decision

Every protected operation must ultimately answer:
- Is the employee active?
- Is the portal identity active?
- Which role assignments are active?
- What access level do those roles grant?
- Is an employee-specific override active?
- Has temporary access expired?
- What data scope applies?
- Is the target record inside that scope?
- Is this action allowed?

## Target access levels
- None: no access
- View: read-only
- Edit: read + operational create/update
- Approve: privileged/final workflow action

Permission definitions may restrict which levels are valid. For example a pure view capability should not present Edit or Approve in the UI.

## Target scope catalogue
Phase 2/3 design should support a controlled subset of:
- Own records
- Assigned records
- Team
- Reporting hierarchy
- Branch
- Zone
- Department
- Vertical
- Selected locations
- Selected employees
- Entire organisation

Not every permission should support every scope.

## Target role categories

### Business roles
Director, Sales Head, Zonal Head, Area Sales Head, Sales Manager, Relationship Manager, Operations Head, Backoffice Executive, Claims Head, Claim Processor, Field Executive.

### Administrative roles
Super Admin and Admin.

### Protected technical role
IT Super User remains a protected technical role and cannot be granted or downgraded through normal employee overrides.

### Roles requiring review before target catalogue is frozen
- Manager: too generic in current security semantics.
- Agent: possible overlap with intermediary/field-sales concepts.

No role will be removed during Phase 1.

## Target database direction
The rebuild should converge toward:
- `roles`
- `permissions`
- `role_permissions`
- `employee_role_assignments`
- `employee_permission_overrides`
- `permission_change_logs`
- portal-account lifecycle/audit records

`profiles.role` must remain supported during migration until parity is proven.

## Multi-role policy
Default employee model:
- one primary role
- optional additional roles
- optional temporary roles with start/end dates

Role grants should combine deterministically. An explicit employee deny must be able to override inherited grants so an added role cannot silently restore access intentionally removed for that employee.

## Privileged access safeguards
The target system must prevent or explicitly control:
- removing the final active Super Admin
- disabling the final protected IT Super User
- granting IT Super User through normal role/permission editing
- self-removal of critical administration access where it would lock out administration
- active portal access for inactive/former employees
- creating access for an inactive employee without explicit reactivation
- privilege escalation beyond the administrator's own authority
- critical changes without reason/audit identity/timestamp/before-after values

## Target Access Control workspace

Primary tabs:
1. Users
2. Roles
3. Permissions
4. Access Reviews
5. Audit Log

### Users
Show employee, portal status, primary role, additional/temporary roles, effective scope, custom exceptions, risk/privilege state, last sign-in and actions.

### Employee Access Profile
Tabs:
- Overview
- Roles
- Permissions
- Data Scope
- Portal Access
- History

### Roles
Role catalogue with employee count, business purpose, default scope and permission matrix. Role changes must show an impact preview before save.

### Permissions
Canonical permission catalogue grouped by module with risk, valid access levels and valid scopes.

### Access Reviews
Surface privileged users, organisation-wide access, custom overrides, expiring access, inactive employee with active portal access, portal user without employee linkage and other access anomalies.

### Audit Log
Record invitations, activations, suspensions, role assignment/removal, permission changes, scope changes, temporary expiry, employee deactivation and other access-security events.

## Implementation phases

### Phase 1 - Authorization audit [IN PROGRESS]
Completed so far:
- Inventory current roles and code-defined capability defaults.
- Inventory permission resolution and protected IT role behaviour.
- Inventory database access-control tables and live role/override usage.
- Inventory employee creation/invite/update/activation lifecycle.
- Identify the shared employee-access-scope helper and its current precedence limitations.
- Confirm Customers uses capability + scoped ID filtering.
- Confirm Claims and Tasks rely heavily on RLS for record visibility.
- Inventory core RLS policies for Customers, Claims, Tasks, Fleet, Policies, Employees, Profiles and Intermediatories.
- Inventory the principal RLS security-definer functions and their hard-coded role groups.
- Identify JWT/profile role precedence and employee/profile hierarchy duplication as migration risks.

Remaining:
- Inventory navigation-only guards versus server-side guards.
- Inventory all privileged actions (approval, activation, user management, exports, master data, integrations).
- Inventory remaining tables used by KYC, reports/exports and notifications where access decisions matter.
- Produce full current-state -> target-state compatibility mapping.

Exit gate: canonical audit accepted and no unresolved ambiguity about existing access semantics.

### Phase 2 - Canonical permission catalogue [PLANNED]
- Define module/action permission catalogue.
- Split broad capabilities where justified.
- Define valid access levels per permission.
- Define valid data scopes per permission.
- Add compatibility mapping from old capabilities.
- No employee access change at cut-over.

### Phase 3 - Role model and default matrix [PLANNED]
- Review every current role.
- Freeze retained/deprecated role catalogue.
- Define role purpose and default scope.
- Build target role-permission matrix.
- Produce current-vs-target impact report before changing production access.

### Phase 4 - Database-backed RBAC foundation [PLANNED]
- Add roles/permissions/role-permission/role-assignment schema.
- Seed from current code-defined roles without changing effective access.
- Keep `profiles.role` compatibility.
- Add protected-role constraints and auditability.

### Phase 5 - Effective access and scope engine [PLANNED]
- Centralize access + scope calculation.
- Support primary/additional/temporary roles.
- Support employee overrides and expiry.
- Implement explicit-deny precedence.
- Return explainable decision metadata.

### Phase 6 - User lifecycle management [PLANNED]
- Formalize employee without portal / invited / active / suspended / disabled / former lifecycle.
- Centralize invite, activate, suspend, restore and offboarding.
- Detect orphan/misaligned employee and Auth identities.

### Phase 7 - Access Control UI rebuild [PLANNED]
- Users / Roles / Permissions / Access Reviews / Audit Log.
- Employee Access Profile.
- Role Editor with impact preview.
- Privileged access UX and confirmation controls.

### Phase 8 - Access parity migration [PLANNED]
- Compute legacy vs new effective access for every existing employee.
- Block cut-over if any unexplained gain/loss exists.
- Preserve existing employee exceptions and protected IT access.

### Phase 9 - Module-by-module scope enforcement [PLANNED]
- Customers
- Intermediatory
- Fleet
- Policies
- Claims
- Tasks
- Employees
- Administration

Each module gets authorization/scoping tests before production cut-over.

## Phase 1 known files/components
- `apps/web-portal/lib/roles.ts`
- `apps/web-portal/lib/permission-management.ts`
- `apps/web-portal/lib/effective-permissions.ts`
- `apps/web-portal/lib/employee-access-scope.ts`
- `apps/web-portal/app/employees/actions.ts`
- `apps/web-portal/app/system/access-control/page.tsx`
- `apps/web-portal/app/system/access-control/actions.ts`
- `apps/web-portal/app/system/access-control/employees/[id]/page.tsx`
- application navigation capability filtering
- `apps/web-portal/app/customers/page.tsx`
- `apps/web-portal/app/claims/page.tsx`
- `apps/web-portal/app/tasks/page.tsx`
- module-specific record queries and server actions
- Supabase RLS policies and security-definer authorization functions
- Auth user lifecycle and JWT role metadata

## Phase 1 safety rule
No role, capability, employee override, portal access, database permission row or production user state will be modified during the audit. Phase 1 changes are documentation/test inventory only.
