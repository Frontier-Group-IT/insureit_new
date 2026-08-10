# INSUREIT Access Control Phase 3 Role Impact

Status: Shadow design complete; no live authorization cut-over
Date: 2026-08-10

## Purpose
This document compares the current code-defined role model with the target V2 shadow role matrix. It is an impact-analysis artifact only. The V2 matrix is not yet used by login, navigation, server actions, RLS, Supabase Auth metadata or production authorization decisions.

## Safety rule
Phase 4 must seed database-backed RBAC from the current effective state and the approved V2 target model without silently granting or removing access. Existing employees must remain on the legacy resolver until parity checks explain every difference.

## Role-by-role impact

### Super Admin
Current state:
- Receives all operational capabilities plus `manage_users` and `manage_system`.
- Effectively shares the same code-defined capability set as Admin and IT Super User.

Target V2:
- Highest business authority across organisation-wide business operations, employee administration, portal users, master data, access administration and system business settings.
- Does not receive protected integration/UAT configuration by default.

Impact:
- Business authority remains broad.
- Technical/developer integration authority is intentionally separated from the owner/business administrator role.

### IT Super User
Current state:
- Same broad code-defined capabilities as Super Admin/Admin, with additional protected behaviour in effective-permission resolution.

Target V2:
- Protected technical authority.
- Non-assignable through ordinary role administration.
- Organisation-wide technical recovery/security authority plus protected integration configuration.

Impact:
- Broad technical recovery access is preserved.
- The role becomes explicitly separated from normal business administration.

### Admin
Current state:
- Same code-defined capability set as Super Admin and IT Super User.

Target V2:
- Organisation-wide operational administrator.
- Can administer employee records, portal users, business records, audit and master data.
- Does not automatically receive role/permission redesign authority or protected integration configuration.

Impact:
- Intentionally narrower than the current all-powerful Admin model.
- Routine administration is separated from security-model ownership and technical integration control.

### Director
Current state:
- Organisation-wide business visibility with intermediary review/approval, KYC review and task-management capability.

Target V2:
- Organisation-wide executive visibility.
- Selected intermediary/KYC review and intermediary approval.
- Operational task management retained.
- No routine system, user or security administration.

Impact:
- Broadly preserved, with clearer separation from administrative/technical permissions.

### Operations Head (`sales_operations_head`)
Current state:
- Broad claims, intermediary onboarding/activation, customer, KYC and task capabilities.

Target V2:
- Organisation-wide operational owner.
- Claims edit/verification/surveyor/stage authority.
- Intermediary application create/review/approve/activate plus training/agreement/IIB workflow.
- Customer and KYC processing/approval.
- Organisation-wide task execution.

Impact:
- Operational authority is intentionally retained but expressed as granular permissions.
- Security/user/system administration remains excluded.

### Backoffice Executive
Current state:
- Organisation-wide intermediary/customer/KYC/task processing capability.

Target V2:
- Organisation-wide processing for intermediary applications, training/agreement/IIB, customers, KYC and tasks.
- No final intermediary activation, permanent deletion, employee/security administration or system authority.

Impact:
- Processing access retained.
- Final/irreversible actions are explicitly excluded.

### Sales Head
Current state:
- Broad sales-hierarchy visibility across claims, intermediary/customer/KYC, employees/org tree, fleet/policies, tasks and reports.

Target V2:
- Reporting-hierarchy scope for the same principal sales/customer/onboarding areas.
- Task assignment remains hierarchy-scoped.
- No final onboarding activation or security administration.

Impact:
- Business intent preserved with explicit hierarchy scope instead of relying on role-name logic.

### Zonal Head
Current state:
- Intermediary/customer/KYC/org-tree/task/report capabilities.

Target V2:
- Same principal modules within reporting hierarchy.

Impact:
- Functionally similar target, but data scope becomes an explicit permission property.

### Area Sales Head (`asm`)
Current state:
- Same broad family as Zonal Head.

Target V2:
- Reporting-hierarchy intermediary/customer/KYC/task/report authority.

Impact:
- Functionally similar target with explicit scope.

### Sales Manager
Current state:
- Reporting-hierarchy sales/customer/onboarding/task access.

Target V2:
- Reporting-hierarchy sales/customer/onboarding/task access.

Impact:
- Principally preserved with explicit scope and granular permissions.

### Relationship Manager
Current state:
- Dashboard, intermediary initiation, customer management, KYC view, tasks and notifications.

Target V2:
- Own-scope intermediary/customer/KYC/task visibility.
- Can create intermediary applications and customers in own scope.
- No intermediary review/approval, task assignment or organisation-wide access.

Impact:
- Front-line ownership model is preserved and made explicitly self-scoped.

### Claims Head
Current state:
- Broad claim management plus task management and reports.

Target V2:
- Organisation-wide claims edit, document verification, surveyor assignment and claim-stage authority.
- Organisation-wide task create/assign/edit.
- Reports view.

Impact:
- Claims ownership preserved while broad `manage_claims` is split into explainable actions.

### Claim Processor
Current state:
- `manage_claims` and `manage_tasks` are broad code capabilities.
- Database helpers currently contain additional role-name logic that may make effective scope wider than intended.

Target V2:
- Assigned claims only.
- Can edit assigned claims, verify documents on assigned claims, depute surveyors on assigned claims and move assigned claim stages at edit level.
- Can view/edit assigned tasks.
- Can create self-owned follow-up tasks.
- Cannot assign tasks to other employees by default.

Impact:
- Significant intentional least-privilege narrowing.
- Phase 4/5 parity tooling must flag every existing Claim Processor whose current RLS access is broader than this target.

### Field Executive
Current state:
- Claim and task visibility; database full-business-data helpers may currently be broader than intended.

Target V2:
- Assigned claims and assigned tasks only.
- No claim edits or organisation-wide business access by default.

Impact:
- Significant intentional narrowing to assigned field work.

### Manager
Current state:
- `ALL_OPERATIONAL` in TypeScript, while database employee-management and other helpers do not consistently grant the same authority.
- Role is semantically too generic.

Target V2:
- Compatibility-only.
- Non-assignable to new employees.
- No target grants are frozen until existing users and RLS dependencies are migrated to specific business roles.

Impact:
- This role must not be deleted during migration.
- Existing Manager users require individual mapping/review before cut-over.

### Agent
Current state:
- Dashboard, customer management, tasks and notifications.
- Also referenced by sales/customer RLS role-name rules.

Target V2:
- Compatibility-only and non-assignable to new employees.
- Temporary self-scoped customer/customer-edit/task-view grants describe intended minimum behaviour while legacy RLS remains.

Impact:
- Existing Agent identities must be reviewed and mapped to Relationship Manager or another business-specific role when appropriate.

## External roles
`customer` and `intermediary` remain external portal identities and are intentionally excluded from the employee-role V2 administration catalogue.

## Highest-risk differences before cut-over
1. Current Super Admin/Admin/IT Super User capability sets are nearly identical; V2 intentionally separates business, administrative and protected technical authority.
2. Current Claim Processor and Field Executive database role helpers can be broader than the target assigned-work model.
3. Current `manager` is broadly privileged in TypeScript but inconsistently privileged in Postgres; no automatic one-to-one V2 migration is safe.
4. Current task management is one broad capability. V2 separates create, assign and edit, preventing processors from automatically assigning work to others.
5. Current intermediary management mixes application review, activation, training, agreement, IIB, portal-user work and permanent deletion across a small number of capabilities. V2 separates them.
6. Current employee management and portal-user management are only partly separated. V2 treats HR/organisation record changes, portal identity management and security administration as distinct authorities.
7. Existing RLS role-name functions must not be replaced until a database-backed effective-access resolver produces proven parity for active users.

## Phase 3 exit decision
The target role catalogue is suitable to proceed into Phase 4 as a shadow seed model provided:
- CI remains green for the catalogue and role-matrix integrity checks;
- no V2 role is wired into live authorization yet;
- Phase 4 retains `profiles.role` and all current RLS paths during migration;
- the new database tables are additive first;
- a legacy-vs-V2 parity report is required before any enforcement cut-over.

## Phase 4 starting point
Phase 4 should add an additive database-backed RBAC foundation for:
- roles
- permissions
- role_permissions
- employee_role_assignments
- compatibility with existing `profiles.role`
- protected-role constraints
- assignment start/end dates
- audit metadata

No existing employee should automatically change effective access merely because the Phase 4 migration is applied.