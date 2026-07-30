# Phase 2 Page Build Plan

This document records the user-facing pages that are missing, incomplete, duplicated or in need of a rebuild after the navigation audit.

## Implemented in the current phase

- Three-level desktop and mobile navigation.
- Add POSP Application menu entry.
- Add MISP Application menu entry.
- POSP/MISP import and batch menu entries.
- Customer onboarding entry points by customer type.
- Add Vehicle menu entry.
- Add Policy menu entry.
- Intermediary Portal User Management workspace.

## Missing pages to build

### 1. New Claim

Proposed route: `/claims/new`

Required workflow:

1. Customer and vehicle selection.
2. Active policy resolution.
3. Incident date, time, location and loss description.
4. Driver and licence details.
5. FIR, spot photographs and supporting-document upload.
6. Duplicate claim detection.
7. Draft saving and final submission.
8. Claim number generation and assignment.

Dependencies:

- Claims table schema review.
- Claim document storage policy.
- Assignment rules.
- Role capability for claim creation.

### 2. Add Employee

Proposed route: `/employees/new`

Required fields:

- Employee code.
- Full name.
- Email and mobile.
- Branch and department.
- Designation and role.
- Reporting manager.
- Joining date and employment status.
- Portal invitation.

Required checks:

- Duplicate employee code.
- Duplicate email.
- Duplicate mobile.
- Reporting hierarchy validation.

### 3. Renewal Management

Proposed routes:

- `/renewals`
- `/renewals/insurance`
- `/renewals/national-permit`
- `/renewals/local-permit`
- `/renewals/road-tax`
- `/renewals/puc`
- `/renewals/fitness`
- `/renewals/driving-licence`

Required capabilities:

- Customer, fleet, vehicle and branch filters.
- Due-in-7/15/30/60-days filters.
- Expired, initiated, document received and completed states.
- Reminder queue.
- Renewal document upload.
- Renewal completion audit trail.

Database work is required before these pages can be implemented safely.

### 4. Reports

Proposed routes:

- `/reports/intermediaries`
- `/reports/claims`
- `/reports/customers`
- `/reports/policies`
- `/reports/renewals`

Intermediary reports:

- Partner creation.
- POSP/MISP conversion.
- Training and exam status.
- Agreement status.
- IIB upload status.
- Portal-access status.
- RM and branch performance.

Claims reports:

- Open claims and ageing.
- Pending documents.
- Survey, repair and settlement stages.
- Insurer and branch analysis.
- Repudiation and turnaround time.

Customer reports:

- Customer type distribution.
- Fleet size.
- Uninsured vehicles.
- KYC and onboarding ageing.

### 5. User and Role Administration

Proposed routes:

- `/admin/users`
- `/admin/roles`
- `/admin/permissions`
- `/admin/invitations`

Required capabilities:

- Internal users.
- Partner/POSP/MISP users.
- Roles and capabilities.
- Branch access.
- Reporting hierarchy.
- Invitation history.
- Suspend and restore access.
- Login audit history.

### 6. Intermediary Portal User Management enhancements

Existing route: `/intermediaries/portal-users`

Current implementation is a working read-only management register.

Remaining work:

- Search and filters.
- Resend invitation from the workspace.
- Suspend and restore account.
- Last-login display.
- Failed invitation display.
- Invitation audit history.

## Existing pages requiring rebuild or consolidation

### Intermediary application details

Current route: `/intermediaries/applications/[id]`

Rebuild goals:

- Shared workflow shell.
- Separate Primary, Documents, Qualification, Agreement and IIB modules.
- One lifecycle status resolver used by tables and detail pages.
- Consistent dirty-form detection.
- Explicit idempotency for repeated save actions.

### Customer onboarding hub

Current entry points use query-string routes under `/customers/new`.

Rebuild goals:

- One onboarding hub with customer-type cards.
- Draft applications.
- Recent applications.
- Progress tracking.
- Canonical route per onboarding type.

### Reports workspace

Current route: `/reports`

Rebuild goals:

- Separate operational report pages.
- Date, branch, employee and customer filters.
- Export support.
- Saved report views.

### Employee workspace

Current route: `/employees`

Rebuild goals:

- Add Employee.
- Reporting hierarchy.
- Teams and branches.
- Roles and portal access.

## Technical quality work

- Add a route inventory script.
- Add a navigation coverage check for user-startable pages.
- Exclude API routes, auth callbacks, record-detail routes and POST handlers.
- Redirect obsolete duplicate routes to canonical pages.
- Run build, typecheck and route tests after each page group is delivered.
