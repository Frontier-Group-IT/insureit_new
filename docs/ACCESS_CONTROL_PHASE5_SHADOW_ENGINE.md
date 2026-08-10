# INSUREIT Access Control Phase 5 - Shadow Effective Access Engine

Status: Core shadow engine complete
Date: 2026-08-10

## Purpose
Phase 5 introduces the deterministic V2 access-decision and data-scope engine while keeping every existing production authorization path authoritative.

Nothing in this phase changes live employee access. The V2 resolver is not connected to navigation, server actions, page guards, RLS policies, Supabase Auth claims, or production employee assignments.

## Implemented components

### Effective permission resolver
File: `apps/web-portal/lib/access-control-effective-v2.ts`

The pure resolver accepts employee/portal active state, active role assignments, optional temporary assignment windows and employee-specific overrides.

Decision precedence:
1. inactive employee or portal identity -> deny
2. protected IT Super User grant -> protected grant
3. active employee override -> explicit deny or direct grant
4. active role grants -> strongest access level; scopes from the strongest grants are combined
5. no grant -> deny

Supported behavior includes:
- multiple active roles
- primary/additional role assignments
- future-starting assignments
- expired temporary assignments
- employee override expiry
- explicit employee deny precedence
- protected IT Super User immunity from ordinary employee overrides
- explainable source/reason metadata on every decision

### Record-scope evaluator
File: `apps/web-portal/lib/access-control-scope-v2.ts`

The pure scope evaluator receives actor context and target-record facts from its caller. It performs no database lookup.

Supported scope predicates:
- `self`
- `assigned`
- `team`
- `hierarchy`
- `branch`
- `zone`
- `department`
- `vertical`
- `selected_locations`
- `selected_employees`
- `organization`

The caller explicitly supplies whether the permission requires record-level scope. This keeps the evaluator independent from catalogue/database lookups and makes the decision contract auditable.

### Scope + compatibility regression
File: `apps/web-portal/scripts/access-control-scope-v2-regression.mjs`

The regression suite covers:
- all current scope predicate families
- Claim Processor assigned-claim enforcement
- Claim Processor self-only task creation
- Sales Head hierarchy filtering
- unscoped administration permissions
- static legacy capability -> mapped V2 permission comparison

The compatibility comparison intentionally checks only the code-defined legacy role capability surface against the V2 permissions explicitly mapped from those capabilities. It does not claim complete production parity because current production authorization also depends on RLS, database functions, stored employee/role overrides, record ownership and hierarchy data.

## Claim Processor safety result
The V2 shadow model now hard-gates the intended least-privilege behavior:
- claim editing: `assigned`
- task creation: `self`
- task editing: assigned work
- task assignment to other employees: not granted

The static compatibility tool must classify legacy `manage_tasks` -> V2 Claim Processor permissions as `narrowed`; it fails if `tasks.assign` is restored.

## CI evidence
Current verified head at Phase 5 checkpoint:
`227cd971fda7510defbc95fd71ef247df8bf3507`

GitHub Actions run:
`31369495284`

Result: success

Passed gates:
- V2 catalogue / role-matrix / SQL seed regression
- V2 scope and legacy compatibility regression
- IFFCO structured OCR regression
- IFFCO OCR regression
- Digit OCR regression
- New India OCR regression
- TypeScript
- ESLint
- Next.js production build

## Production safety boundary
Still unchanged:
- `profiles.role` remains the current compatibility role source.
- existing permission-management logic remains authoritative.
- existing Supabase RLS/security-definer functions remain authoritative.
- V2 RBAC migration is committed in the repository but has not been applied to the live Supabase project.
- `employee_role_assignments_v2` has no automatic employee assignments.
- no V2 table is exposed to normal authenticated clients.
- no live employee has been migrated or re-authorized by V2.

## Next gate
Before any V2 enforcement or production role assignment, the project must add lifecycle/governance support and later run employee-by-employee legacy-vs-V2 parity using real production roles, overrides, hierarchy/ownership data and RLS semantics.

Phase 6 should therefore formalize portal lifecycle states and protected user-management operations without yet cutting authorization over to V2.
