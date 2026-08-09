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

- Intended owner: Anand Wadhwa
- Verified company email from existing company correspondence: `anand@frontiervehicles.com`
- Intended role: `super_admin`
- Scope: organisation-wide business access
- Technical/development workspace: reserved for `it_super_user`
- Owner landing page: `/dashboard`
- Password handling: official Supabase invitation/password-setup flow; do not manually share a password.
- Formal employee designation: **not yet resolved from source data**. Do not invent it in the employee master.
- Account creation: **NOT YET DONE** — final employee master designation and authenticated smoke remain.

## Phase status

### 1. Owner-visible navigation — SOURCE PASS / RUNTIME SMOKE PENDING

- Reports hidden from normal desktop/mobile navigation.
- Development/iCall UAT restricted to `it_super_user`.
- Super Admin retains business Settings/admin access.
- Mobile navigation confirmed to use the same filtered source.

### 2. Dashboard — SOURCE PASS / RUNTIME SMOKE PENDING

- Business KPI structure is suitable for owner review.
- No links to hidden Reports/Development areas.
- Claim-document destination no longer exposes raw database errors.
- False permanent notification unread dot removed.

### 3. Intermediatory — SOURCE PASS WITH ONE VISUAL FIX PENDING / RUNTIME SMOKE PENDING

- Partner/POSP/MISP registers use controlled failure states.
- Portal Users uses business-facing status grouping and IST timestamps.
- Normal iCall workflow no longer exposes UAT/test-environment wording.
- Six explicit business stages confirmed: Primary, Documents, Registration, Training & Exam, Agreement, IIB Upload.
- Workflow errors are normalized.
- Registration completion remains tied to signed registration form for new onboarding, with historical progression preserved.
- Parent-child registration certificate projection remains intact.

Key commits:
- `12233a3897bf7f41eb1f3a762b54178f045efc5a`
- `1882f1930e428a6d96ce8c79230130f456db7a8d`
- `b5b1a936f48314d1b454e993661ad7c06db3c6fe`

Known visual FIX:
- Workflow identity header has a light container with white identity text. Correct during final visual pass without touching workflow logic unnecessarily.

### 4. Customers, Fleet and Policies — SOURCE PASS / RUNTIME SMOKE PENDING

- Customer Register and Customer KYC use controlled load paths.
- Vehicle/Policy registers no longer expose raw Supabase errors.
- Add Vehicle/Add Policy show intentional setup-unavailable states instead of framework errors.
- RC lookup no longer exposes provider exception text.
- Register empty states, filters, search and pagination are presentation-ready at source level.

Key commits:
- `29af4285073f5598daed427f5ea0199239049043`
- `2c455644acab32e8d080990dbafe28f816ad118e`
- `9fccb984e621dec98cc785a63927bfb4fa7db7c2`
- `dcceb7336fdb739a788dd804c331462f94be6e8e`
- `f150ec0697f9c12d463bf803509ed9d54f9f3daa`

Runtime checks still required for Add Vehicle, Add Policy, RC lookup and policy OCR.

### 5. Claims — SOURCE PASS / DEEP WORKFLOW RUNTIME SMOKE PENDING

- Claims register/work queues are structured, searchable and paginated.
- Register no longer passes raw query error messages to the UI.
- Claim detail source uses controlled routing and authenticated document-open endpoints; claim lookup failure resolves to not-found rather than dumping query text.
- Claim document verification page was sanitized in handover batch 1.

Implementation commit:
- `da3ce22e5ae0cd6a0e244c29d75923a1975c9642`

Runtime checks still required across Documents, Verification, Survey, Under Repair and Settlement journeys.

### 6. Tasks and Notifications — SOURCE PASS / RUNTIME SMOKE PENDING

- Tasks has controlled load-error and intentional empty states.
- Search/status filtering is business-facing.
- Notifications uses operational activity data.
- False unconditional unread indicator removed globally.

### 7. Employees, Settings and Access Control — SOURCE PASS / RUNTIME SMOKE PENDING

- Employee Directory supports role-based portal invitations and clearly differentiates invited/active users.
- Employee register no longer exposes raw query errors.
- Employee Directory defaults to Active staff, with inactive history still available by filter.
- Portal invitation permission check uses the valid `approve` access level.
- Employee create/update/invite/status failures now use controlled UI messages instead of arbitrary backend text.
- Settings provides a focused business administration entry point.
- Access Control database/save/reset failures are converted to controlled administrator messages.
- Access Control terminology was simplified from engineering language to standard business access language.
- Access changes remain audited and organisation scope remains visible.

Implementation commits include:
- `b72ffa2cac92c4d2b48e4b5bd53c4f0bc753604a`
- `3fa425fd39ceeeeaa0766f55c59744fe19039893`
- `7d68c4bb8d73e49e0d935df72bb7827917fa2794`
- `8229ed36a98f1dd8fcbdc30ebfed5b7d44c7cb93`
- `ebf051d1c3e4f2445c07f6a534b79c3552efda68`

### 8. Global polish — PARTIAL SOURCE PASS / FINAL VISUAL SMOKE PENDING

Completed:
- major owner-visible raw DB/provider error paths sanitized across Intermediatory, Fleet/Policy, Claims and Administration;
- business navigation no longer exposes blank Reports or IT UAT tools;
- normal onboarding no longer presents UAT/test copy;
- inactive employee history is not the default owner view.

Outstanding targeted visual checks:
- workflow identity header contrast;
- Account Review direct `?error=` presentation if an action fails;
- desktop visual smoke at 1366x768, 1440x900 and 1920x1080;
- policy OCR runtime failure wording.

### 9. Data/demo sanity — SOURCE/DATA CHECK PASS WITH NO DELETION

Production checks performed without deleting business data:
- no obvious `test/demo/dummy/sample` customer or intermediary names were found in the primary registers queried;
- no existing employee/profile for Anand Wadhwa was found;
- no active `super_admin` profile currently exists;
- the only active top technical account remains the existing `it_super_user` account;
- historical inactive employee records, including an old `DEMO` code, were preserved rather than deleted;
- Employee Directory now defaults to Active staff so inactive history does not dominate the owner view.

### 10. Owner-account smoke test — BLOCKED BY AUTHENTICATED USER CREATION

Required after the owner or a temporary Super Admin invitation is created:
- sign in through the same invite/password flow the owner will use;
- verify Dashboard and every visible navigation destination;
- verify Reports/Development are absent for `super_admin`;
- verify Settings/Access Control are available;
- open representative Partner/POSP/MISP, customer, policy, claim and employee records;
- verify desktop layout and controlled error/empty states.

### 11. Owner account creation — READY EXCEPT FORMAL DESIGNATION / FINAL SMOKE

Resolved fields:
- Name: Anand Wadhwa
- Email: `anand@frontiervehicles.com`
- Portal role: `super_admin`
- Data scope: Entire organisation
- Landing page: Dashboard
- Authentication: email invite + owner sets password

Still required:
- exact employee designation to store in Employee Directory (not reliably present in connected correspondence);
- employee code/department should follow the organisation's preferred master-data convention when the record is created.

## Deployment record

### Handover batch 1
- Source SHA: `12233a3897bf7f41eb1f3a762b54178f045efc5a`
- Trigger: `ab79d76d04ee985e520258513a7b387ada44d47e`
- Run: `31309989237` — deploy hook workflow **success**.

### Handover batch 2
- Source SHA: `49ad4e4de0b14d7a58faf9a300832d3fd42f73f2`
- Trigger: `e0455961f2b2addb7e14acce7691b1fb4e8817ed`
- Run: `31310303322` — deploy hook workflow **success**.

### Handover batch 3
- Source SHA: `b36c7ea78114e1f5b8627ee327f4c1d25f77e9b1`
- Trigger: `add1edfe82675ea91adbbfc7dd55a39bb454d8e6`
- Run: `31310474523` — deploy hook workflow **success**.

### Handover batch 4
- Trigger: `db0c2cf754253fec392ade399f581e73bd45040a`
- Run: `31310738623` — deploy hook workflow **success**.
- Scope: Claims and Administration handover cleanup.

Workflow success confirms the Vercel deploy-hook request, not the final authenticated Vercel smoke test.

## Formal production-readiness note

The repository's formal production readiness audit/checklist remains authoritative for production release. Owner handover readiness controls the internal executive presentation only and is not production certification.
