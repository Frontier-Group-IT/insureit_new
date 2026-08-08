# Current Chat Handoff

> **Consolidated:** 2026-08-08 17:00 IST
>
> Read this file with `docs/INSUREIT_PROJECT_CONTEXT.md` before continuing work. This is a curated continuation state, not a chat transcript. Never store secrets, tokens, cookies, passwords, private keys, full Aadhaar numbers, full bank-account values, or MCP credentials here.

## 1. Current product focus

The active work now has two immediate tracks:

1. **Policy Onboarding / insurer master data** — normalize and extend the Insurance Company master, preserve current policy references, and prepare the master for canonical insurer names, aliases and portal metadata.
2. **Intermediatory** — Partner, POSP and MISP onboarding, account review, shared identity details, documents and qualification workflows.

Repository:

- `Frontier-Group-IT/insureit_new`
- Main application: `apps/web-portal`
- Next.js App Router + Supabase/PostgreSQL + Supabase Storage
- Vercel production is triggered separately; ordinary commits do not deploy.

## 2. Confirmed business rule: shared identity, separate workflows

**APPROVED BUSINESS RULE**

A Partner and its linked POSP/MISP account are two account/workflow records representing one person or business identity.

The following are shared and must remain synchronized in both directions:

- RM/associate assignment
- Person/business name
- MISP designated-person details
- Phone and email
- PAN, Aadhaar metadata and date of birth
- Address and PIN code
- GST details
- Bank details
- OEM where applicable
- Document-received date
- Education status
- Aadhaar front/back
- PAN copy
- Cancelled cheque
- Photograph
- GST certificate
- Selected education marksheet

The following remain account-specific and must never be copied by the shared-data synchronization:

- Partner ID
- POSP/MISP ID
- Application ID
- Account context
- Partner activation state
- POSP/MISP registration state
- Training
- Examination
- Agreement
- IIB preparation/registration
- Portal access
- Workflow timestamps
- Training, registration and agreement certificates

## 3. Root cause confirmed

Before the current fix, linked-account creation copied Partner profile and document rows into the child POSP/MISP application. Later edits updated only the selected application row because writes were scoped by `application_id`. Partner Review also read only its own profile/documents. Therefore the UI showed stale Partner information after editing the linked account.

This was a data-ownership/synchronization defect, not a browser cache or frontend refresh issue.

## 4. Shared identity synchronization implementation

**IMPLEMENTED IN REPOSITORY — NOT YET APPLIED TO SUPABASE**

Migration:

- `supabase/migrations/20260803182500_sync_linked_intermediary_shared_identity.sql`
- Commit: `cdc9b4c041305e174d54469f7117587320ca1f95`

The migration adds database triggers that:

1. Resolve the canonical `partner_record_id` for an application.
2. Synchronize the approved shared profile fields across every application linked to that Partner record.
3. Synchronize safe application mirrors (`applicant_phone`, `applicant_email`, and non-secret `draft_data` fields).
4. Update existing Partner/POSP/MISP contact projections without resetting portal or membership state.
5. Synchronize only identity documents across the linked applications.
6. Preserve qualification documents as account-specific.
7. Prevent recursive trigger loops with `pg_trigger_depth()`.
8. Remove obsolete sibling education-document references when a different marksheet type replaces them.
9. Remove the sibling GST-document reference when GST is cleared; the initiating application path remains responsible for its own storage cleanup.

No historical backfill is included because the user confirmed all current records are dummy. The rule is intended for data entered after the migration is applied.

## 5. Onboarding paths covered

The synchronization is database-level, so it is designed to cover all current write paths rather than only one page.

### Add New POSP/MISP

- Creates the initial Partner-side onboarding application and profile.
- Mandatory Partner documents are completed.
- Partner ID is generated automatically by the existing Partner activation process.
- The linked POSP or MISP application is then created with the same canonical `partner_record_id`.
- Child creation initially inherits the Partner profile/documents.
- Subsequent edits from either account trigger bidirectional synchronization.

### Add Existing POSP/MISP

- Uses the legacy/existing onboarding path.
- Previously issued Partner and POSP/MISP IDs are preserved.
- The Partner application is activated/linked to the canonical Partner record.
- The existing linked POSP/MISP child uses the same `partner_record_id`.
- Subsequent edits from either account trigger the same synchronization.

The migration does not change automatic Partner ID generation, legacy ID preservation, linked-account limits or qualification workflow transitions.

## 6. Required next steps before calling the bug fixed live

1. Review the migration against the current Supabase schema and migration history.
2. Apply `20260803182500_sync_linked_intermediary_shared_identity.sql` to the target Supabase environment.
3. Confirm the migration completed successfully. A Git commit is not proof that it is applied.
4. Create a fresh normal POSP test account:
   - finish Partner details/documents;
   - confirm automatic Partner ID creation;
   - create/open linked POSP;
   - edit name, phone, address and bank data from POSP;
   - verify Partner Review immediately shows the same values;
   - edit from Partner and verify POSP Review.
5. Repeat with a fresh MISP including DP, GST and OEM fields.
6. Repeat with the Add Existing path and historical IDs.
7. Replace Aadhaar/PAN/cheque/photograph/marksheet/GST documents from both account sides and verify both reviews reference the same new file.
8. Confirm training, exam, agreement, IIB and IDs remain unchanged on the sibling account.
9. Test clearing GST and changing education-marksheet type.
10. Check for orphaned Supabase Storage objects after replacement.

Do not claim the fix is live until these steps are directly verified.

## 7. Intermediatory frontend audit state

A source-code audit was completed for the full Intermediatory workflow. The main conclusions were:

- Workflow coverage is strong.
- Typography is generally too small.
- Register/table implementations are inconsistent and desktop-heavy.
- Colours, spacing, buttons, icons, statuses and page headers need one shared design system.
- New POSP/MISP, Account Review, Workflow and Import Row Review need the largest redesign.
- Manrope + Space Grotesk, the navy navigation shell, pending button states, masking and workflow separation should be preserved.

For Account Review, the user previously selected findings F3, F4, F5, F6, F7, F9, F10 and F11 for safety review. They were assessed as implementable in staged groups, but those UI findings have not been implemented in this conversation.

## 8. Plasmic pilot state

The user created a Plasmic project for a visual frontend pilot.

- Project ID: `5o884piubV2YWSShhMBfbd`
- Project name/direction: `InsureIt Intermediatory UI Pilot`
- Page: Intermediatory Overview
- Page path: `/intermediaries`
- Basic page header and search/action toolbar were being assembled manually.
- Fonts/direction:
  - Manrope for body/UI
  - Space Grotesk for headings
  - page background `#F4F7FB`
  - primary text `#17203A` / heading `#0F172A`
  - secondary text `#64748B`
- The Plasmic design is not integrated into the Next.js repository and is not published.

The Plasmic repository includes `ai/skills/plasmic-designer`, which can control Studio through Chrome DevTools MCP in a local Codex/agent environment. This ChatGPT session does not currently have Chrome DevTools MCP access to the user’s logged-in Plasmic workspace.

## 9. Deployment and safety state

- Intermediatory shared-identity migration committed to `main`.
- Supabase application state for that migration: **UNAPPLIED / UNVERIFIED**.
- Do not infer a production deployment from ordinary commits.
- `.deploy/production-trigger.json` is reserved for explicit user-requested production deployment.
- No production claim should be made without exact Vercel evidence and live workflow verification.

## 10. Partner signed-registration certificate projection

**IMPLEMENTED — NOT DEPLOYED/VERIFIED LIVE**

The signed registration certificate remains owned by the POSP/MISP child application as `document_type = signed_registration_form`. It must not be duplicated into the Partner's document rows or copied in storage. The Partner review should project the same child document read-only through a signed storage URL.

Verified root cause on 2026-08-07: `apps/web-portal/app/api/intermediary-documents/context/route.ts` already resolved the linked POSP/MISP and projected `signed_registration_form`, but the canonical review component `IntermediaryDocumentReviewPortal` was not mounted in the application review layout. The server-rendered Partner checklist therefore continued reading only the Partner application's own document rows and could never display the child certificate.

Fix:

- `apps/web-portal/app/intermediaries/applications/[id]/layout.tsx`
- Commit `158b4829ae20a2f901930720b9f8d87809561367`
- The layout now mounts `IntermediaryDocumentReviewPortal`, which replaces the review-page document checklist with the shared 10-slot document grid using `/api/intermediary-documents/context`.
- The context route resolves linked children by canonical `partner_record_id`, with `draft_data.parent_partner_application_id` as fallback, and exposes the same stored certificate object through a temporary signed URL.

No database migration is required for this display fix. Production deployment and authenticated Partner/POSP/MISP verification remain pending.

## 11. Policy OCR / Google Document AI current state

**IMPLEMENTED IN REPOSITORY; LIVE END-TO-END VERIFICATION STILL REQUIRED UNLESS NEWER EVIDENCE EXISTS.**

Production OCR architecture is intentionally:

`Policy upload → Google Document AI OCR → INSUREIT server-side insurer detector/parser → Section 03 review modal → user applies selected fields`

Durable rules:

- Google Document AI performs OCR/text/layout only. Insurer-specific interpretation remains in INSUREIT.
- Production uses Vercel OIDC Workload Identity Federation with short-lived Google credentials. Do not create/download a Google service-account JSON key for this design.
- Google project: `insureit-policy-ocr-production`.
- Document AI location: `us`.
- Production service account identity is the dedicated `insureit-ocr-web` service account. Never store credentials or tokens in repository context.
- Supported dedicated parsers currently include Digit, IFFCO-Tokio and New India; generic fallback exists for unsupported formats. United India CPM is not an approved forced mapping to motor OD/TP/CPA.
- OCR may propose only approved Section 03 fields: policy product, IDV, OD premium, TP premium, CPA opted/premium, policy number, insurer, policy start and end date.
- Net premium, tax/GST and gross premium are verification/comparison values unless the schema is explicitly changed.
- Review-before-apply is mandatory; OCR must never silently overwrite customer/vehicle/manual values.
- Existing local PaddleOCR is development/comparison only unless production fallback is explicitly reintroduced.
- Keep old `POLICY_OCR_SERVICE_URL` / `POLICY_OCR_SERVICE_SECRET` environment variables until Google OCR has been directly verified in production with the supported formats; then they may be removed deliberately.

Relevant implementation:

- `apps/web-portal/app/policies/policy-ocr-actions.ts`
- `apps/web-portal/lib/policy-ocr-parsers.ts`
- `apps/web-portal/components/policy-ocr-import-panel.tsx`
- PR #199 was merged for Google Document AI integration; merge commit recorded during the implementation was `8b08adb79f818d81bab2fccbdfd59baa2c46bd85`.
- Local verification before merge: typecheck passed; lint completed with warnings only; production Next.js build completed successfully. Build success is not live Google-auth/OCR proof.
- A Digit sample was successfully read by Google Document AI in provider testing and the parser logic was validated against the expected policy dates/premium fields. Do not treat that console/provider test as production INSUREIT end-to-end proof.

Deployment caution from the previous deployment attempt:

- A production trigger commit `1bfde759edfcda6de4ba7bffa2c04ac6f7dd83b8` was created to request deployment of the OCR work.
- The original push did not visibly create a new production-workflow run at the time checked, so an older production workflow job was re-run to invoke the protected Vercel hook.
- That GitHub Actions run was last observed queued in the prior session. A queued workflow or hook acceptance is not deployment proof.
- Future agents must inspect current `main`, GitHub Actions and exact Vercel deployment evidence before saying Google OCR is live. If Vercel auth fails, verify STS/IAM Credentials APIs and the service-account `roles/documentai.apiUser` grant rather than introducing long-lived keys.

## 12. Insurance Company master — active approved direction

**APPROVED REQUIREMENT — IMPLEMENTATION/SEED NOT YET COMPLETED.**

The user wants the insurer workbook and INSUREIT insurer master normalized so the canonical insurer name is the insurer's **full registered/legal company name**, not an abbreviation or casual brand label.

Examples of the intended behavior:

- `Star` / `Star Health` are aliases/search terms, while the canonical name should be the full registered company name, e.g. `Star Health and Allied Insurance Company Limited` after source verification.
- `GoDigit Ins.` / `Go Digit` should resolve to the current verified registered legal entity name, not remain as the canonical short label.

Do not guess legal names from memory. Verify current registered names from authoritative insurer/IRDAI/company sources before seeding or rewriting the workbook.

### Existing schema and compatibility constraints

Current `insurance_companies` base schema contains:

- `id uuid`
- `name text unique not null`
- `branch_name`
- `contact_email`
- `contact_phone`
- `claims_portal_url`
- timestamps

Current referential behavior matters:

- `policies.insurance_company_id` references `insurance_companies(id)` with `ON DELETE RESTRICT`.
- `claims.insurance_company_id` and `surveyors.insurance_company_id` also reference this table.
- Therefore **never truncate/recreate the insurer table or replace referenced UUIDs casually**. Preserve existing insurer IDs wherever historical/current records reference them and perform controlled merge/rename/migration logic.

Current Add Policy route loads insurer options directly from `insurance_companies` and currently has no canonical `is_active` filter in the observed implementation. The legacy inline insurer-create action also still expects branch name, contact email, phone and claims portal URL. These need to be reconciled with the new master model instead of silently preserving obsolete requirements.

### Target canonical model direction

The approved direction is to evolve `insurance_companies` toward canonical master fields such as:

- existing `id` preserved
- `name` = full registered company name
- `segment` = relevant insurer segment/category (for example general, health, life where applicable)
- `sibpl_code` or equivalent business-facing insurer code from the client workbook
- `portal_url` / canonical portal metadata
- `is_active`
- timestamps

Use a separate alias/search mapping rather than putting short labels into the canonical name. Proposed direction:

`insurance_company_aliases`

- `insurance_company_id`
- `alias`
- normalized alias/search key

Aliases are intended for OCR matching, search/autocomplete and backwards-compatible recognition of short workbook labels. They are not the displayed canonical registered name.

### Workbook/security rule

The client insurer workbook may contain fields such as SIBPL Code, Segment, Portal and potentially portal usernames/passwords.

- Portal usernames/passwords must **not** be stored in the normal `insurance_companies` master, exposed to browser/UI payloads, or committed in seed/migration/context files.
- If credentials are operationally required later, design a separate secrets-management approach with explicit authorization; do not mix credentials into ordinary master data.
- The corrected workbook requested by the user should normalize insurer company names to verified full registered names while preserving non-secret business fields as appropriate.

### Current blocker

The exact client Insurance Companies workbook containing the intended insurer rows was not available in the active file search during the last audit. Do not reconstruct the complete insurer list from memory or from unrelated policy data.

**Next required input:** obtain/re-upload the exact insurer workbook, then:

1. read every insurer row exactly;
2. verify each current registered/legal company name from authoritative sources;
3. prepare a normalized workbook copy;
4. map existing `insurance_companies` rows and referenced UUIDs;
5. design a non-destructive migration/merge strategy;
6. seed canonical names, segment/code/portal metadata and aliases;
7. add active/inactive behavior and update Policy Onboarding lookup/create behavior;
8. run typecheck/lint/build and focused tests;
9. do not apply Supabase migration or deploy until evidence and the user's deployment instruction support those states.

## 13. Policy Onboarding insurer-selection safety requirement

**APPROVED REQUIREMENT — NOT YET IMPLEMENTED IN THE OBSERVED CODE.**

After the canonical insurer master is introduced:

- New policy onboarding should select only active canonical insurers.
- Historical policies must continue to render their previously referenced insurer even if that insurer later becomes inactive.
- Server-side onboarding must validate that a newly selected insurer ID resolves to an allowed canonical master record; do not rely only on the browser dropdown.
- OCR insurer detection should resolve aliases to the canonical insurer ID/name where possible, then present the canonical full registered company name in review.
- Do not auto-create arbitrary new insurer master rows from OCR text.
- The legacy inline insurer-create workflow should be reviewed and either removed from normal policy onboarding or restricted to authorized master-data management with the new canonical fields.
