# INSUREIT Project Context and Technical Handover

> **Last consolidated:** 2026-08-02 (IST)
>
> This is the durable project context for developers and AI agents working on the INSUREIT repository. Read this file before changing intermediary, Partner, POSP, MISP, onboarding, document, registration, portal-user, or IIB workflows. Update it after material business-rule, schema, workflow, or architecture changes.

## 1. Repository and operating model

- Repository: `Frontier-Group-IT/insureit_new`
- Primary web application: `apps/web-portal`
- Framework: Next.js 15 App Router with server actions
- Backend: Supabase/PostgreSQL and Supabase Storage
- Deployment: Vercel from `main`
- Current project working agreement: commit approved changes directly to `main` unless the user explicitly requests a branch or pull request.
- Before modifying an existing file, fetch the current `main` version and use its current blob SHA.
- Do not claim that a build, Vercel deployment, SQL migration, or live workflow succeeded unless there is direct evidence.
- A committed migration is not the same as an applied migration.

## 2. Product domain model

### 2.1 Partner is the permanent parent identity

A Partner is the permanent parent business identity. It is not a qualification account.

- Individual Partner can have one linked POSP account.
- Business Partner can have one linked MISP account.
- A Partner must not show training, examination, agreement, or IIB qualification stages.
- A Partner onboarding journey has only:
  1. Primary details
  2. Partner documents

### 2.2 POSP and MISP are linked qualification accounts

POSP and MISP are linked accounts that inherit their parent Partner relationship.

- POSP is linked to an Individual Partner.
- MISP is linked to a Business Partner.
- Both POSP and MISP use the qualification workflow:
  1. Partner linked
  2. Training
  3. Exam
  4. Agreement
  5. Active / IIB registered
- MISP also requires training and examination. Do not skip those stages merely because the account is MISP.

### 2.3 One linked registration only

A Partner may have only one linked registration account of the permitted type.

Action rules:

- Individual Partner with no linked account: `Create POSP`
- Business Partner with no linked account: `Create MISP`
- Linked application exists, including an incomplete one: `View linked POSP` or `View linked MISP`

Do not create duplicate linked applications when a child application already exists.

## 3. Canonical identifiers

### 3.1 Partner ID

- Normal onboarding may generate the Partner ID automatically.
- Legacy/existing onboarding must allow the previously issued Partner ID to be entered manually.
- The permanent Partner ID must be synchronized across the canonical Partner record, onboarding profile, application context, and register display.
- Do not replace a manually entered legacy Partner ID with a generated series number.

Relevant fields include:

- `partners.partner_code`
- `posp_misp_onboarding_profiles.partner_id`
- `intermediaries.intermediary_code` for the Partner register representation
- application/profile `partner_record_id`

### 3.2 POSP/MISP ID

- Normal onboarding uses `next_registration_code()`.
- Legacy/existing onboarding must use the previously issued POSP/MISP ID entered during the legacy Partner onboarding flow.
- Legacy IDs may use arbitrary valid historical formats, for example `SIB/2026/08/01`; do not require `POSP-` or `MISP-` prefixes.
- The reserved legacy registration ID must transfer from the temporary Partner-side reservation to the linked POSP/MISP profile when the child account is created.
- Do not generate a new ID for a legacy linked account.

Relevant fields include:

- `posp_misp_onboarding_profiles.external_onboarding_id`
- `posp_misp_onboarding_profiles.existing_registration_code`
- `intermediary_registrations.registration_code`
- `intermediaries.intermediary_code`
- application `draft_data.legacy_registration_code`
- application `draft_data.issued_registration_code`

## 4. Normal onboarding workflow

Normal POSP/MISP onboarding remains a live workflow and must not be bypassed by legacy logic.

Typical stages:

1. Primary information and PAN check
2. Documents
3. Registration / Partner linkage
4. Training and examination
5. Agreement
6. IIB preparation, submission and registration

Normal onboarding should continue to:

- Generate IDs through the normal numbering function.
- Require valid workflow transitions.
- Maintain role and permission checks.
- Preserve validation and audit records.

## 5. Legacy/existing onboarding workflow

### 5.1 Purpose

Legacy onboarding imports Partners, POSPs, and MISPs that already existed before INSUREIT became the system of record.

The legacy flow must support:

- Manual Partner ID
- Manual POSP/MISP ID
- Original onboarding date
- Active-since date
- Verification remarks
- Historical stage status selections
- Existing documents
- Partial completion, not only fully active accounts

### 5.2 Legacy primary screen stage selectors

The first legacy onboarding screen must ask for the actual status of every qualification stage:

- Training status
- Exam status
- Agreement status
- IIB file-upload status
- IIB registration status

Do not automatically mark these stages completed.

The selected values must be saved consistently to:

- application `draft_data`
- onboarding profile
- training/exam/agreement assignment record
- registration record
- account journey and register status

Use only values accepted by the current live database constraints. Do not invent enum values.

**APPLIED 2026-08-12:** Existing Intermediary Migration edits must be synchronized through `public.sync_existing_intermediary_migration(...)`, introduced by `20260812120000_atomic_existing_intermediary_migration_sync.sql`. Do not reintroduce separate draft/profile/register updates from the server action; earlier partial-save behavior let the edit section show new IDs while Partner/POSP/MISP canonical rows stayed stale. The RPC updates application draft JSON, profile identifiers/raw data, `partners.partner_code`, `intermediaries.intermediary_code`, `intermediary_registrations.registration_code`, and assignment statuses in one transaction, including temporary code moves to allow safe Partner/POSP/MISP ID swaps under unique indexes.

**APPLIED 2026-08-12:** `20260812153000_fix_existing_intermediary_profile_id_swap.sql` extends the RPC to temporarily free `posp_misp_onboarding_profiles.external_onboarding_id` before writing final Partner/POSP/MISP IDs. This is required because `validate_posp_misp_external_onboarding_id_trigger` is row-level and can reject an otherwise valid family swap while a sibling profile still holds the old target ID.

### 5.3 Activation rule

A legacy POSP/MISP is considered fully active only when all of these are true:

- Training: completed
- Exam: passed
- Agreement: signed
- IIB file: uploaded
- IIB registration: registered

Otherwise, the account remains under onboarding at the earliest unfinished stage.

Examples that must be supported:

- Training pending, exam not allotted, agreement not started, IIB pending
- Training completed, exam passed, agreement signed, IIB file uploaded, registration submitted
- Training completed, exam failed, agreement pending
- Fully registered historical account

### 5.4 Legacy remarks

Migration verification remarks require a meaningful explanation. A two-character value such as `ok` is invalid. Client-side validation should block the request before submission and show an inline error.

## 6. Canonical Partner record linkage

Creating a visible Partner intermediary row is not sufficient. The application must be linked to a canonical row in `partners`.

Required relationships:

- `intermediary_onboarding_applications.partner_record_id`
- `posp_misp_onboarding_profiles.partner_record_id`
- canonical `partners.id`

The linked-account action must resolve the Partner record in this order:

1. Existing application/profile `partner_record_id`
2. `partners.source_application_id`
3. `partners.partner_code`
4. `ensure_legacy_partner_record(...)` repair function

The action should repair missing links automatically where safe instead of immediately returning `partner_account_required`.

Known required `partners` columns discovered from the live schema:

- `partner_kind` is non-null
- `source_application_id` is non-null

Partner kinds:

- Individual/POSP parent: `individual`
- Business/MISP parent: `business`

## 7. Important live database constraints learned during debugging

These constraints caused repeated failures. Future code must inspect current schema/defaults before inserting guessed values.

### 7.1 `intermediaries`

Live schema has required fields including:

- `requested_type`
- `display_name`

Do not manually force constrained workflow values without confirming the check constraint. Earlier failures involved:

- `intermediaries_compliance_status_check`
- `intermediaries_iib_status_check`

Safer rule: insert required identity fields and allow database defaults/triggers for constrained status fields unless the accepted enum is confirmed.

### 7.2 `posp_misp_onboarding_profiles`

Confirmed IIB upload-status values:

- `uploaded`
- `pending`
- `null`

`completed` is not valid for `iib_upload_status`.

`iib_remarks` also has a check constraint. Use `null` unless an explicitly accepted value is known. The text `Legacy registration confirmed` caused a constraint failure.

### 7.3 Registration and assignment statuses

Status values must match the live schema. Current workflow code has used values such as:

- Training: `pending`, `completed`
- Exam: `not_allotted`, `passed`
- Agreement: `not_started`, `signed`
- IIB registration: `pending`, `registered`

Before extending these lists, inspect the live migration/schema definition.

## 8. Partner, POSP and MISP register design

### 8.1 Partner register

One Partner equals one row. Do not duplicate the Partner and linked POSP/MISP as separate Partner rows.

Recommended columns:

- Partner
- Partner ID
- Type
- Assigned RM
- Linked account
- Portal access
- Status
- Action

### 8.2 POSP/MISP registers

Registers should show the actual permanent registration ID, including historical formats. Resolution should consider:

1. linked intermediary code
2. profile external onboarding ID
3. existing registration code
4. registration record code
5. only then a pending fallback

Do not hide a valid legacy ID because it lacks a `POSP-` or `MISP-` prefix.

## 9. Review and edit pages

### 9.1 Partner review page

Partner review must show only the two Partner stages.

It may provide:

- Create linked POSP/MISP
- Edit details
- Create/resend portal user
- Open linked account

### 9.2 POSP/MISP edit permissions

The UI and server must agree on editability.

Active legacy accounts may need corrections after import. The server action now permits approved, active Partner-linked POSP/MISP records to:

- Save corrected primary details
- Add or replace documents
- Preserve existing Partner and POSP/MISP IDs
- Preserve current training, exam, agreement and IIB states
- Avoid moving the workflow backward

Document edits must not be restricted only to `iib_processing` when an existing account is already at a later stage.

### 9.3 Sensitive data

Never expose full Aadhaar, PAN, bank account, or other sensitive identity data in review/register screens. Use masking and encrypted/hash storage patterns already present in the repository.

## 10. IIB preparation workflow

### 10.1 Purpose

`Prepare IIB data` validates and prepares portal fields. It does not by itself mean the POSP/MISP has been registered by IIB.

Primary files:

- `apps/web-portal/app/intermediaries/applications/iib-submission-stage.tsx`
- `apps/web-portal/app/intermediaries/applications/iib-submission-actions.ts`

Prepared packet storage:

- Primary: `intermediary_iib_submission_packets`
- Resilient mirror: application `draft_data.iib_submission_packet`

The mirror exists so preparation remains visible if the dedicated packet table is missing or temporarily unavailable in an older database.

### 10.2 Expected redirect

After preparation, redirecting back to the POSP/MISP account review page is normal. The page should show either:

- Prepared portal values and a ready state, or
- Exact missing fields

### 10.3 Registered-account safeguard

A POSP/MISP already marked IIB registered must not be moved backward to `iib_submission_pending` merely because someone clicked `Prepare IIB data`.

Registered accounts should show a green registered state, and preparation/handoff actions should be disabled or treated as read-only.

Migration added for synchronization and prevention:

- `20260802143500_sync_registered_iib_application_status.sql`

This migration must be applied before claiming the live safeguard is active.

## 11. Important code areas

- `apps/web-portal/app/intermediaries/applications/[id]/account-review-actions.ts`
  - Creates linked POSP/MISP accounts
  - Resolves/repairs Partner linkage
  - Transfers legacy registration reservation
  - Writes historical stage state

- `apps/web-portal/app/intermediaries/applications/[id]/existing-intermediary-migration-actions.ts`
  - Saves Existing Intermediary Migration corrections
  - Must call `sync_existing_intermediary_migration(...)` rather than issuing separate downstream Supabase updates

- `apps/web-portal/app/intermediaries/applications/[id]/page.tsx`
  - Partner/POSP/MISP account review presentation
  - Journey display
  - Linked-account actions

- `apps/web-portal/app/customers/applications/intermediary-edit-actions.ts`
  - Primary-detail and document editing
  - Edit locks and workflow preservation

- `apps/web-portal/app/customers/applications/posp-misp-application-editor.tsx`
  - Edit UI and document validation

- `apps/web-portal/app/intermediaries/applications/iib-submission-actions.ts`
  - IIB packet preparation and handoff

- `apps/web-portal/app/intermediaries/applications/iib-submission-stage.tsx`
  - IIB packet display and actions

- `apps/web-portal/app/intermediaries/overview-register.tsx`
  - Combined intermediary overview

- `apps/web-portal/app/intermediaries/intermediary-register.tsx`
  - Partner/POSP/MISP register presentation and actions

- `apps/web-portal/app/master-data/insurance-companies`
  - Canonical Insurance Company master route under Master Data
  - Uses the existing `insurance_companies` and `insurance_company_aliases` tables for policy onboarding, reporting and OCR/name matching
  - Create/update/activate mutations require `manage_master_data` with edit access and write audit-log entries

### 11.1 Policy Onboarding registration-pending vehicles

**APPLIED 2026-08-12:** Policy Onboarding supports two vehicle registration modes in Section 02:

- `registered` is the default. Vehicle registration number is required, AuthBridge RC lookup is available, and duplicate/ownership checks use normalized registration number.
- `unregistered` is for new vehicles whose permanent RC number has not yet been issued. Registration number is optional/disabled, AuthBridge lookup is unavailable, and chassis number plus engine number are required.

The canonical save path remains `onboard_motor_policy(p_payload jsonb)`. Do not add a parallel save path for registration-pending vehicles.

Current storage rule:

- `vehicles.vehicle_no` remains `not null unique`, so unregistered vehicles receive an internal `PENDING-<chassis>` vehicle reference.
- `vehicles.vehicle_no_normalized` stays null for unregistered vehicles so RC search/deduplication is not polluted by fake values.
- `vehicles.registration_status` is saved as `registration_pending`.
- `policy_party_snapshots.registration_number` stores `REGISTRATION PENDING` because that snapshot column is currently non-null.
- Existing ownership checks for unregistered vehicles use chassis number. Registered vehicles continue to use normalized RC number.

Do not enter fake registration values such as `NEW`, `NA`, `TEMP`, or `APPLIEDFOR` into the RC field. When the permanent RC number is later available, add a reviewed update flow that compares AuthBridge chassis/engine evidence before marking the vehicle as registered.

## 12. Migration and repair history

The following migrations were introduced during the legacy-onboarding repair sequence. Some were responses to live-schema differences and may have failed before later replacements were added. Always inspect Supabase migration history and current function definitions before assuming all are applied.

- `202608010003_intermediary_registration_status_compatibility.sql`
- `202608010004_backfill_legacy_reserved_ids.sql`
- `202608010005_fix_legacy_partner_intermediary_requested_type.sql`
- `202608010006_fix_legacy_partner_intermediary_required_fields.sql`
- `202608010007_fix_legacy_partner_compliance_status.sql`
- `202608010008_stop_overriding_constrained_intermediary_statuses.sql`
- `202608010009_create_missing_legacy_partner_record.sql`
- `202608010010_repair_all_legacy_partner_links.sql`
- `202608010011_fix_legacy_partner_kind.sql`
- `202608010012_fix_legacy_partner_source_application_id.sql`
- `202608010013_sync_partner_ids_to_register.sql`
- `202608010014_backfill_legacy_partner_record_links.sql`
- `20260802143500_sync_registered_iib_application_status.sql`
- `20260812120000_atomic_existing_intermediary_migration_sync.sql` — **APPLIED** to Supabase project `ilzhsfqqjyppzzvfscmh` on 2026-08-12; installs `sync_existing_intermediary_migration(...)`.
- `20260812153000_fix_existing_intermediary_profile_id_swap.sql` — **APPLIED** to Supabase project `ilzhsfqqjyppzzvfscmh` on 2026-08-12; updates `sync_existing_intermediary_migration(...)` to temp-move profile `external_onboarding_id` values during family ID swaps.

- `20260812170500_policy_onboarding_unregistered_vehicle_mode.sql` - **APPLIED** to Supabase project `ilzhsfqqjyppzzvfscmh` on 2026-08-12; updates `onboard_motor_policy(...)` to accept `vehicle.registrationMode='unregistered'`, use internal pending references, and allow registration-pending policy snapshots.
- `20260812171500_fix_unregistered_vehicle_chassis_lookup.sql` - **APPLIED** to Supabase project `ilzhsfqqjyppzzvfscmh` on 2026-08-12; follow-up fix ensuring the live RPC uses chassis lookup for registration-pending vehicles.
- `20260812173500_fix_unregistered_vehicle_validation.sql` - **APPLIED** to Supabase project `ilzhsfqqjyppzzvfscmh` on 2026-08-12; follow-up fix ensuring the live RPC no longer requires registration number when `vehicle.registrationMode='unregistered'`.

Important lesson: several early repair functions failed because the live `partners` or `intermediaries` table had additional non-null/check constraints. New repair SQL should introspect or explicitly include all known required columns and should not guess constrained statuses.

## 13. Relevant commit history from the legacy-onboarding work

This is a working trace, not a substitute for `git log`.

- `f293739a21dc2486c3ba4d92152f099ffb5b527d` — initial Partner register redesign
- `fce86632064b5ecad3b32c1622fec9345235fb32` — Partner workflow displays only two stages
- `37efa5ed3ae95447e31d063ffaa1a7b9d7986081` — use reserved legacy registration ID in linked account creation
- `20bbc13b8385bbf2dee9a37bd54c3173f2d403b9` — create missing canonical legacy Partner record
- `0f274eda6afaf735354e6aebfd25efeae0148023` — add required Partner kind
- `9ecba2b4e4dade4c9088ef70cac7b1f0f5e2dbe9` — add source application linkage
- `ebcc37f816a0515ed8ecd48bc9996d66c63a9cd1` — synchronize Partner IDs to register
- `1938fa54ab250a905b54f36c59e4aae1e2fdaeb5` — repair Partner relationship in linked-account action
- `60ce3b739a64bf496fd1150f6e1ed9b78dd76d65` — transfer legacy registration reservation to child profile
- `3dde9e88c8e78e864f7434623352606fcd7e5c7f` — valid `iib_upload_status=uploaded`
- `7e93fdf4809557a4fa8c1eed70ef260a640c94e2` — capture actual legacy stage statuses and display legacy IDs
- `af759cc4439d8dba10a8923375f7891dd832fb21` — resilient IIB packet fallback
- `6f8d347b2ce0aabba0ff6bcf2490dec296afb3bd` — allow safe edits/documents for active linked accounts
- `313a57fa4a44207e7b548d5956ff824c1420ed6b` — prevent registered IIB state regression in action logic
- `7861bee9b4a6e558589f738e12d01953705d9c9d` — registered IIB state UI safeguard
- `555050c6b9082932039534876472dcabf828fab9` — registered IIB database synchronization migration

## 14. Known current state and verification status

As of this consolidation:

- Legacy Partner ID and POSP/MISP ID entry are supported in the intended flow.
- Legacy stage selectors were added so imported accounts are not automatically marked complete.
- Partner review shows only Partner stages.
- POSP/MISP register logic was updated to accept historical ID formats.
- Linked-account creation contains automatic Partner-link repair and legacy-ID transfer logic.
- Active linked accounts can be edited without forcing the workflow backward.
- IIB packet preparation has a draft-data fallback.
- Registered IIB accounts have code and migration safeguards against regression.
- Existing Intermediary Migration edits now use an applied atomic RPC for canonical ID/status synchronization. **DEPLOYED 2026-08-12:** production trigger commit `0d48d1c750ec7d1e26697391e370eaecb36b5fed`, GitHub Actions run `31581565649`, Vercel deployment `dpl_6eBut6oTAU4r4KZJPrAtftMYmB96`, state `READY`.

Still verify in the live environment:

- Latest Vercel deployment has completed successfully.
- `20260802143500_sync_registered_iib_application_status.sql` has been applied.
- Existing affected records show `IIB Registered`, not `IIB Submission Pending`.
- Legacy POSP and MISP creation works for both fully complete and partially complete historical stage combinations.
- Register IDs appear for all historical formats.
- Edit primary details and replace documents work for approved/active legacy accounts.
- Existing Intermediary Migration edits should be re-saved on any affected record whose draft IDs already differ from canonical Partner/POSP/MISP rows; direct data repair requires confirming the intended Partner ID and POSP/MISP ID first.
- No duplicate Partner, registration, profile, or intermediary rows are created on repeated clicks.

## 15. Mandatory verification checklist for future changes

Before claiming a fix is complete:

1. Fetch current `main` files and schemas.
2. Confirm actual database enum/check constraints.
3. Preserve normal onboarding behavior.
4. Preserve manually entered legacy identifiers.
5. Preserve Partner-to-child relationship and one-linked-account rule.
6. Confirm Partner pages never show qualification stages.
7. Confirm POSP and MISP both support training and examination.
8. Confirm partial legacy stage states remain partial.
9. Confirm registered IIB state cannot regress.
10. Check loading, validation, error and retry states.
11. Run available lint/typecheck/build/tests.
12. Verify Vercel or explicitly state that deployment is unverified.
13. Verify required migrations in Supabase or explicitly state that they are not confirmed applied.

## 16. Maintenance rule

After a material change, update this file with:

- New business rule or corrected invariant
- Changed table/column/status constraint
- New migration name and whether it was applied
- Important commit SHA
- Remaining verification item

Do not turn this file into a raw chat transcript. Keep it as the current, actionable source of truth, and retain failed approaches only when they explain a schema or workflow hazard that future developers must avoid.

## 17. Premium OCR training workflow

**APPLIED / QUEUE VERIFIED 2026-08-21:** migration `20260821153000_premium_ocr_training_workflow.sql` extends policy-copy training with an idempotent queue, three-attempt leased processing, bounded retry delays, proposal metadata, separate reviewer and owner approval, and sanitized approved-candidate storage. Supabase workflow `32513396428` verified 286 policy-copy documents, 286 queue labels and 286 pending jobs.

Durable rules:

- Only approved Policy Onboarding Section 03 values and comparison totals enter proposals/corrections.
- Raw OCR text, document bytes, identity fields and real policy numbers never enter training candidates.
- `review_policy_ocr_training` submits corrections; `approve_policy_ocr_training` gives final owner approval. Reviewer and owner must be different profiles.
- Approved candidates use deterministic synthetic policy numbers and do not modify parser source. Parser changes remain reviewed code changes with sanitized regressions.
- Policy-copy inserts/replacements create/reset the label only. They must not invoke Google automatically.
- **IMPLEMENTED ON DRAFT PR #530 / NOT YET DEPLOYED 2026-08-22:** an authorized reviewer/owner explicitly selects one queue row and runs Google OCR. Configuration/OIDC preflight happens before an optimistic claim of that exact label; there is no cron, upload follow-up or page-visit scheduling. Section 03 comparison still reads saved policy/premium values and never overwrites policy records.
- Vehicle extraction remains gated. Use `docs/POLICY_OCR_SECTION_02_FIELD_MAP.md` as the exact form/payload/database contract before adding Section 02 proposal fields.
