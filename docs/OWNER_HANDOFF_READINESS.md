# INSUREIT Owner Handover Readiness

> Started: 2026-08-09 IST
>
> Purpose: prepare a controlled, polished Super Admin experience for company-owner review before credentials are shared. This is an executive/internal handover readiness track, not a substitute for the formal production release checklist.

## Operating rule

Every route visible to the owner must be classified as one of:

- **PASS** — useful, understandable and presentation-ready.
- **FIX** — remains visible only after the identified owner-facing defect is corrected.
- **HIDE** — intentionally excluded from owner navigation until implemented/polished.

Do not expose blank routes, UAT/development utilities, raw provider/database errors, placeholder content, or obviously unfinished workflows in the owner-facing navigation.

## Owner account model

- Intended role: `super_admin`
- Scope: organisation-wide business access
- Technical/development workspace: reserved for `it_super_user`
- Owner landing page: `/dashboard`
- Account creation: **NOT YET DONE** — create only after visible-route walkthrough passes.

## Phase status

### 1. Owner-visible navigation — IN PROGRESS

Completed:

- Reports removed from normal navigation while `/reports` remains unfinished.
- Development/iCall UAT navigation restricted to `it_super_user`.
- Super Admin retains Settings and business administration capabilities.

Implementation commit:

- `55714e163b36ade02fa6c12850cfe769668319a9` — Prepare owner-facing navigation for handover

Remaining in this phase:

- Audit all still-visible navigation destinations.
- Decide whether import/migration utilities remain owner-visible after visual/functional review.
- Confirm mobile navigation inherits the same filtered navigation source.

### 2. Dashboard — NOT STARTED

Check:

- Business KPIs are meaningful and trustworthy.
- No dashboard card links to hidden/unfinished routes.
- Empty/error states are professional.
- Greeting/profile display is appropriate for the owner.
- No provider/developer terminology is exposed.

### 3. Intermediatory — NOT STARTED

Check Partner/POSP/MISP registers, Applications, Portal Users, onboarding workflows, documents, Registration, Training & Exam, Agreement, IIB, final account review and parent-child relationships.

### 4. Customers, Fleet and Policies — NOT STARTED

Check Customer Register, KYC, customer onboarding, vehicle register, policy register, add/edit journeys, RC lookup and policy OCR presentation.

### 5. Claims — NOT STARTED

Check All Claims, Documents, Verification, Survey, Under Repair, Settlement and claim detail/workflow presentation.

### 6. Tasks and Notifications — NOT STARTED

Check empty states, filters, status language, destination links and notification behavior.

### 7. Employees, Settings and Access Control — NOT STARTED

Check employee directory, employee creation, Settings, access-control terminology, role labels and Super Admin presentation.

### 8. Global polish — NOT STARTED

Check typography, spacing, buttons, statuses, tables, desktop resolutions, raw technical errors, placeholder/UAT/test terminology and empty states.

### 9. Data/demo cleanup — NOT STARTED

Review obvious dummy/test records before owner access. Do not delete production/business data without explicit approval.

### 10. Owner-account smoke test — NOT STARTED

Create a test Super Admin profile identical in access to the intended owner account and walk every visible route before creating/sharing the real account.

### 11. Owner account creation — BLOCKED BY READINESS

Create only when phases 1–10 have passed or remaining exceptions are explicitly accepted.

## Formal production-readiness note

The repository's formal production readiness audit/checklist remains authoritative for production release. Owner handover readiness only controls what is presented during the internal executive review and must not be represented as production certification.
