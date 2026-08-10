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

Current resolution order is:
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

Important audit finding: access level resolution is centralized, but scope is not yet a first-class record-level authorization decision throughout the application. Phase 1 therefore treats data-scope enforcement as a major cut-over requirement rather than a UI-only feature.

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
2. The role-level override table exists but has no complete role-management UI/workflow.
3. `profiles.role` supports only one role per employee.
4. Designation and security role are conceptually too easy to confuse.
5. Scope values are stored but record-level scope enforcement is not consistently centralized.
6. Several capabilities are too broad for long-term administration.
7. Access Control is employee-exception oriented rather than full user governance.
8. Portal lifecycle states such as no access, invited, active, suspended and disabled are not first-class in the access workspace.
9. There is no dedicated role editor, permission catalogue, access-review workspace or comprehensive security timeline.
10. Generic roles such as `manager` require business review before being retained as security roles.

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
- Inventory current roles and capability defaults.
- Inventory database access-control tables and current live usage.
- Inventory user-management lifecycle and employee/profile/Auth linkage.
- Identify every module/route/action that depends on authorization.
- Identify every module that applies its own hierarchy/ownership filtering.
- Produce current-state -> target-state mapping.
- No live permission behaviour change.

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
- `apps/web-portal/app/system/access-control/page.tsx`
- `apps/web-portal/app/system/access-control/actions.ts`
- `apps/web-portal/app/system/access-control/employees/[id]/page.tsx`
- employee creation/invitation actions and forms
- application navigation capability filtering
- module-specific record queries and server actions

## Phase 1 safety rule
No role, capability, employee override, portal access, database permission row or production user state will be modified during the audit. Phase 1 changes are documentation/test inventory only.
