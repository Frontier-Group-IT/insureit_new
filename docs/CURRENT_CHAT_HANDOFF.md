# Current Chat Handoff

> **Consolidated:** 2026-08-07 22:05 IST
>
> Read this file with `docs/INSUREIT_PROJECT_CONTEXT.md` before continuing work. This is a curated continuation state, not a chat transcript. Never store secrets, tokens, cookies, passwords, private keys, full Aadhaar numbers, full bank-account values, or MCP credentials here.

## 1. Current product focus

The active work is the **Intermediatory** module covering Partner, POSP and MISP onboarding, account review, shared identity details, documents and qualification workflows.

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

- Migration committed to `main`.
- Supabase application state: **UNAPPLIED / UNVERIFIED**.
- Vercel deployment: **NOT TRIGGERED**.
- `.deploy/production-trigger.json` was not modified.
- No production claim should be made.

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
