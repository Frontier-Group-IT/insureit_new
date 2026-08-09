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
- Mobile drawer confirmed to use the same `visibleNavigationSections(...)` filtering source.
- Mobile bottom navigation does not expose Reports or Development.

Implementation commit:

- `55714e163b36ade02fa6c12850cfe769668319a9` — Prepare owner-facing navigation for handover

Pending before final PASS:

- Runtime Super Admin smoke test on desktop and mobile.

### 2. Dashboard — IN PROGRESS

Source review findings:

- Dashboard structure and business KPI presentation are suitable for owner review.
- Dashboard does not link to the hidden Reports or Development areas.
- The `Documents to review` destination was useful but its target page exposed raw database error text. This was corrected to a controlled business-facing error state.
- The global notification bell displayed a red unread indicator unconditionally. The false indicator was removed until a real unread-state source is wired.

Implementation commits:

- `5dce28231e8c8b37f8f9dff3b64404721c64c264` — Remove false unread notification indicator
- `9a0e4263fe21cfc97e8c651151240f7ef916c63b` — Polish document verification error state for handover

Pending before final PASS:

- Runtime verification of KPI links and empty states with current data.
- Desktop visual check at 1366x768, 1440x900 and 1920x1080.

### 3. Intermediatory — SOURCE PASS WITH ONE VISUAL FIX PENDING / RUNTIME SMOKE PENDING

Completed source-level improvements and verification:

- Applications register is intentionally limited to pending Partner onboarding and uses a controlled load-error state.
- Partner register raw action errors are no longer rendered directly from query/provider text.
- Partner register load failure and empty states provide controlled recovery guidance.
- POSP and MISP registers use the structured account register and do not expose raw backend failures.
- Partner Portal Users now groups all non-active states under `Needs attention`, shows business-facing status labels, formats invitation timestamps in IST, and has controlled empty/load-error states.
- Normal POSP/MISP Training UI no longer exposes `Test integration`, `UAT only`, `iCall UAT` or test-environment wording. The underlying integration remains unchanged; technical UAT tooling stays in the IT Super User Development workspace.
- Current workflow route explicitly supports the six business stages: Primary, Documents, Registration, Training & Exam, Agreement and IIB Upload.
- Stage-specific visibility is confirmed: Registration, Training and Agreement pages hide unrelated workflow sections.
- Workflow error handling uses controlled messages and duplicate-field normalization instead of rendering arbitrary backend text.
- Registration completion remains tied to the signed registration form for new onboarding; later-stage historical accounts are grandfathered.
- Existing parent-child document projection and signed registration-certificate behavior remain intact.

Implementation commits:

- `12233a3897bf7f41eb1f3a762b54178f045efc5a` — Sanitize partner register errors for handover
- `1882f1930e428a6d96ce8c79230130f456db7a8d` — Polish iCall training UI for business handover
- `b5b1a936f48314d1b454e993661ad7c06db3c6fe` — Polish intermediary portal users for handover

Known visual FIX before final PASS:

- The workflow route header currently uses a translucent white container while the applicant name/permanent-ID text classes are white. Correct the header treatment in the UI polish pass so the identity header has reliable contrast.

Runtime checks still required:

- Partner/POSP/MISP registers with current production data.
- Application Review and all six workflow stages with one real linked Partner/POSP or Partner/MISP family.
- Registration certificate visibility on child and parent review pages.
- Portal User invite/active/disabled states.

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

## Deployment record

### Handover batch 1 — DEPLOY HOOK SUCCESS / LIVE VERCEL READY STATE NOT YET VERIFIED

- Source code SHA: `12233a3897bf7f41eb1f3a762b54178f045efc5a`
- Deployment trigger commit: `ab79d76d04ee985e520258513a7b387ada44d47e`
- GitHub Actions run: `31309989237`
- Workflow result: **success**
- Confirmed workflow steps: deploy-hook secret check, Vercel deploy-hook request, deployment summary.
- Limitation: repository workflow success proves the hook request completed; final Vercel build/Ready state and authenticated live smoke test remain separate checks.

## Formal production-readiness note

The repository's formal production readiness audit/checklist remains authoritative for production release. Owner handover readiness only controls what is presented during the internal executive review and must not be represented as production certification.
