# INSUREIT Access Control Rebuild — Phase 2 Legacy Expansion Report

Status: COMPLETE
Date: 2026-08-10

## Purpose
Show how each current code-defined role expands through the legacy-capability -> V2 compatibility map. This is a shadow diagnostic only. It is not the target role matrix and does not change production access.

## Catalogue status
- V2 permissions: 46
- Legacy capabilities: 24
- Legacy capabilities with compatibility mapping: 24 / 24
- V2 permissions represented by legacy compatibility: 40
- New V2 permissions with no direct legacy capability equivalent: 6

New-only V2 permissions:
- `intermediaries.portal_users.manage`
- `kyc.approve`
- `vehicles.create`
- `vehicles.edit`
- `policies.create`
- `policies.edit`

These are intentional. They represent distinctions the old capability model cannot express directly.

## Legacy role expansion counts

| Legacy role | Legacy capabilities | Unique V2 permissions produced by compatibility map |
|---|---:|---:|
| Super Admin | 24 | 40 |
| Admin | 24 | 40 |
| IT Super User | 24 | 40 |
| Manager | 22 | 33 |
| Director | 16 | 21 |
| Operations Head | 16 | 25 |
| Sales Head | 17 | 23 |
| Zonal Head | 13 | 19 |
| Area Sales Head | 13 | 19 |
| Sales Manager | 13 | 19 |
| Relationship Manager | 8 | 12 |
| Claims Head | 7 | 12 |
| Claim Processor | 6 | 11 |
| Field Executive | 4 | 4 |
| Backoffice Executive | 11 | 17 |
| Agent | 5 | 6 |

Customer and Intermediary are external portal roles and are excluded from the employee-role redesign.

## Important expansion observations

### Super Admin, Admin and IT Super User are currently indistinguishable at the legacy capability level
All three roles currently receive the same 24 code-defined capabilities. Their product behavior differs mainly through special-case logic such as protected IT Super User handling and owner-facing navigation hiding of Development/UAT.

Target requirement: Phase 3 must separate:
- highest business authority (Super Admin)
- operational security administrator (Admin)
- protected technical authority (IT Super User)

### Generic Manager is excessively broad
Legacy Manager expands to 33 V2 permissions, including claims operations, intermediary approval/activation, employee administration and master data.

Target requirement: do not carry this broad generic role forward without an explicit business purpose. Keep it only as a compatibility role until affected employees are reviewed.

### Operations Head is currently very powerful
Operations Head expands to 25 V2 permissions and currently includes claims management, intermediary create/review/approve/activate, customer management, KYC review and task management.

Target requirement: retain broad operational authority only where it matches the actual job purpose; privileged approval/activation permissions should be explicit.

### Sales hierarchy roles currently share broad onboarding workflow access
Sales Head, Zonal Head, Area Sales Head and Sales Manager inherit combinations of intermediary create/review plus customer/KYC/task access. Because legacy intermediary create/review currently gates several training/agreement/IIB actions, their compatibility expansion includes those workflow permissions too.

Target requirement: Phase 3 must decide which sales roles may only initiate, which may review, and which may complete later workflow stages.

### Relationship Manager compatibility expansion is broader than a simple salesperson role
The legacy role can create intermediary applications and manage customers, so compatibility expansion includes intermediary training/agreement/IIB workflow because of current shared authorization helpers.

Target requirement: this is a legacy side effect, not necessarily desired future authority.

### Claims Head and Claim Processor need different final authority
Both currently receive broad `manage_claims` semantics. The V2 split exposes document verification, surveyor assignment and workflow-stage changes separately.

Target requirement: Claims Head should normally hold broader approval/oversight than Claim Processor; Phase 3 will encode that explicitly.

### Field Executive database scope is a special migration risk
TypeScript legacy capabilities are limited, but production Postgres `can_access_full_business_data()` currently treats Field Executive as full-business-data. The target role matrix must not be applied until RLS compatibility is addressed in later phases.

### Agent remains a compatibility role
Agent is currently embedded in customer assignment and sales RLS logic. It cannot be removed from the system merely because its business meaning overlaps other concepts.

Target requirement: retain for compatibility until RLS/customer ownership is migrated, then decide whether it remains an employee security role.

## Phase 2 CI gate
The compulsory web-portal verification now runs:
- Access Control V2 catalogue regression
- existing OCR regressions
- TypeScript typecheck
- lint
- Next.js production build

The V2 regression verifies:
- unique permission keys
- valid access levels
- valid data scopes
- non-empty legacy mappings
- compatibility mappings reference existing V2 permissions

Latest Phase 2 shadow catalogue verification passed after moving the regression harness out of TypeScript compilation.

## Phase 2 exit decision
Phase 2 is complete for the initial canonical catalogue.

No live authorization behavior changed.

Phase 3 may now define the target role catalogue and target role-permission/default-scope matrix. The Phase 3 matrix must remain shadow-only until legacy-vs-target impact is reviewed.
