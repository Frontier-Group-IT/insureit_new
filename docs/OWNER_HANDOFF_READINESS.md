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

### 1. Owner-visible navigation — SOURCE PASS / RUNTIME SMOKE PENDING

Completed:
- Reports removed from normal desktop and mobile workspace navigation while `/reports` remains unfinished.
- Development/iCall UAT navigation restricted to `it_super_user`.
- Super Admin retains Settings and business administration capabilities.
- Mobile drawer confirmed to use the same filtered navigation source.
- Mobile bottom navigation does not expose Reports or Development.

Pending: runtime Super Admin smoke test on desktop and mobile.

### 2. Dashboard — SOURCE PASS / RUNTIME SMOKE PENDING

Completed:
- Dashboard business KPI structure is suitable for owner review.
- No links to hidden Reports or Development areas.
- Claim document destination no longer exposes raw database errors.
- False permanent unread notification indicator removed.

Pending: runtime KPI-link, empty-state and desktop-resolution checks.

### 3. Intermediatory — SOURCE PASS WITH ONE VISUAL FIX PENDING / RUNTIME SMOKE PENDING

Completed:
- Applications register uses a controlled load-error state.
- Partner register no longer renders raw action/provider errors.
- POSP/MISP structured registers use controlled failures.
- Partner Portal Users now uses business-facing labels, correct active/needs-attention grouping, IST invitation timestamps and controlled empty/error states.
- Normal POSP/MISP iCall training UI no longer exposes UAT/test-environment terminology.
- Six explicit business stages confirmed: Primary, Documents, Registration, Training & Exam, Agreement, IIB Upload.
- Stage-specific visibility confirmed.
- Workflow errors are normalized to controlled messages.
- Registration completion remains tied to signed registration form for new onboarding, with historical progression preserved.
- Parent-child registration-certificate projection remains intact.

Implementation commits:
- `12233a3897bf7f41eb1f3a762b54178f045efc5a`
- `1882f1930e428a6d96ce8c79230130f456db7a8d`
- `b5b1a936f48314d1b454e993661ad7c06db3c6fe`

Known visual FIX:
- Workflow identity header currently has a light container with white identity text classes; correct contrast in the global UI pass.

Runtime checks still required on a real linked Partner/POSP or Partner/MISP family.

### 4. Customers, Fleet and Policies — SOURCE PASS / RUNTIME SMOKE PENDING

Completed source review and cleanup:
- Customer Register already presents a polished searchable/filterable business register with controlled server load failure.
- Customer KYC uses a controlled `loadError` path rather than exposing raw query text.
- Vehicle Register and Policy Register were visually strong but exposed raw Supabase error messages; both now use controlled business-facing recovery states.
- Add Vehicle previously threw raw setup/master-data errors into the framework error page; it now renders a controlled in-page setup-unavailable state.
- Add Policy previously threw insurer/intermediary/RM linkage errors into the framework error page; it now renders a controlled in-page setup-unavailable state.
- RC lookup previously returned the underlying provider exception message to the policy form; it now returns a stable business-facing retry message.
- Vehicle and Policy register empty states, filters, search and pagination are presentation-ready at source level.

Implementation commits:
- `29af4285073f5598daed427f5ea0199239049043` — Sanitize vehicle register errors
- `2c455644acab32e8d080990dbafe28f816ad118e` — Sanitize policy register errors
- `9fccb984e621dec98cc785a63927bfb4fa7db7c2` — Polish Add Vehicle setup failures
- `dcceb7336fdb739a788dd804c331462f94be6e8e` — Polish Add Policy setup failures
- `f150ec0697f9c12d463bf803509ed9d54f9f3daa` — Sanitize RC lookup failures

Runtime checks still required:
- Customer Register and Customer KYC with current data.
- Add Vehicle with normal and missing-master scenarios.
- Policy Register/Add Policy with RC lookup and policy OCR.
- Verify no provider terminology appears in user-facing OCR failure states.

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

## Deployment record

### Handover batch 1
- Source SHA: `12233a3897bf7f41eb1f3a762b54178f045efc5a`
- Trigger: `ab79d76d04ee985e520258513a7b387ada44d47e`
- GitHub Actions run: `31309989237`
- Result: deploy hook workflow **success**; final authenticated live smoke still separate.

### Handover batch 2
- Source SHA: `49ad4e4de0b14d7a58faf9a300832d3fd42f73f2`
- Trigger: `e0455961f2b2addb7e14acce7691b1fb4e8817ed`
- GitHub Actions run: `31310303322`
- Result: deploy hook workflow **success**; final authenticated live smoke still separate.

## Formal production-readiness note

The repository's formal production readiness audit/checklist remains authoritative for production release. Owner handover readiness only controls what is presented during the internal executive review and must not be represented as production certification.
