# Current Chat Handoff

> **Consolidated:** 2026-08-12 (IST)
>
> Read with `docs/INSUREIT_PROJECT_CONTEXT.md` and `docs/POLICY_OCR_GOOGLE_DOCUMENT_AI_HANDOFF.md`. Never store secrets, raw OCR text, policyholder PII, or complete policy documents here.

## Active track

Policy Onboarding OCR hardening remains an active workstream. Production portal is `https://portal.insureit.in`. Ordinary commits do not intentionally deploy production; `.deploy/production-trigger.json` is changed only after the user explicitly says `deploy now` or `finish and deploy`.

A separate master-data administration change was added on 2026-08-12: protected deletion controls for existing customers, vehicles, policies, and claims are available only to the `it_super_user` role in the Customers, Vehicles, Policies, and Claims registries. Customer/vehicle/policy deletion and the later claim-delete extension are both deployed to production.

## IT Super User master-record and claim deletion controls

Implemented on `main` on 2026-08-12.

Files:

```text
apps/web-portal/app/master-record-delete-actions.ts
apps/web-portal/components/it-super-user-delete-panel.tsx
apps/web-portal/app/customers/page.tsx
apps/web-portal/app/vehicles/page.tsx
apps/web-portal/app/policies/page.tsx
apps/web-portal/app/claims/page.tsx
```

Security and behavior rules:

- The deletion panel renders only when the authenticated server profile role is exactly `it_super_user`.
- The server action independently re-authenticates and rejects every role except exact `it_super_user`; UI visibility is not the security boundary.
- Deletion uses the server-only Supabase admin client only after this exact role check.
- The UI requires selecting the exact record and typing `DELETE` before permanent deletion.
- Customer deletion is blocked while linked vehicles, policies, or claims exist.
- Vehicle deletion is blocked while linked policies or claims exist.
- Policy deletion is blocked while linked claims exist.
- Claims can be explicitly deleted by `it_super_user` so the dependency chain can be cleared before deleting a policy, vehicle, or customer.
- Claim deletion deletes only the selected claim as the root record. Existing database `ON DELETE CASCADE` relationships remove linked claim metadata rows; linked policy, vehicle, and customer remain intact.
- Before claim deletion, claim-document storage bucket/path metadata is collected. After database delete succeeds, the server makes a best-effort cleanup of corresponding stored files.
- Successful deletion writes an `audit_logs` entry with actor, table, record id, and deletion source.
- Customer Auth/profile identities are intentionally not deleted by this feature; Auth identity removal remains a separate explicit operation.
- Do not weaken customer/vehicle/policy dependency checks or convert them to broad cascade deletion without explicit product approval.

Original customer/vehicle/policy implementation commits:

```text
f928a951fbca0504499ebcfb2903203a94b2c19c
e23f0a98cb2b2f2af52823cf6c5b15aab89d9cba
bd0a8d6e57503552f14d5813b003acf683eac0de
2e1e7f907fbaac888941e5ffe0a1ecbb441163df
87e59f659c050d8d447d4f8a44a0dace8a5fac15
```

Original feature verification: GitHub Actions run `31571721254`, SUCCESS.

Production deployment of original customer/vehicle/policy controls:

```text
Deployment trigger commit: 0b74c06dbeb678a55299c0ec3031645ba4a4412c
GitHub Actions production run: 31572246538
Vercel deployment: dpl_CaJm81BXrJ4FXpMUnya74ti33A6m
Production state: READY
Alias: portal.insureit.in
```

Claim-delete extension commits:

```text
a104a5ebf1d7bb93bedb42339fe02ff38c87c103
ed9549d35a46d43c2a36cd62a5686629804a3770
ae67335110df70884d4724005bcd39551b1bc7ce
```

Claim-delete feature verification: GitHub Actions run `31573206603`, SUCCESS.

Claim-delete production deployment:

```text
Deployment trigger commit: 2b8852469fcb1fe5232a1ce5f18686c2b08e9c7b
GitHub Actions production run: 31573488279
Vercel deployment: dpl_5w8MUsVTEZK4wEubL4TtJMybofWM
Production state: READY
Alias: portal.insureit.in
```

## Customer deletion cascade hotfix

On 2026-08-12, live production testing showed a dependency-free customer could still fail deletion with a generic foreign-key message.

Root cause found in the live Supabase Postgres log:

- deleting a customer cascades deletion into `customer_documents`;
- `trg_capture_customer_document_delete_activity` is an `AFTER DELETE` trigger on `customer_documents`;
- its function attempted to insert a `customer_activity_events` row using `old.customer_id` even though the parent customer was being deleted;
- PostgreSQL rejected that insert on `customer_activity_events_customer_id_fkey`, rolling back the customer deletion.

Production database fix applied through Supabase migration:

```text
20260812073421_fix_customer_document_delete_activity_on_customer_cascade.sql
```

The function `capture_customer_document_delete_activity()` now first checks whether the customer still exists. If the customer row no longer exists because the document deletion is part of a parent-customer cascade, it skips creation of the activity event. Explicit individual customer-document deletion still creates the activity event while the customer exists.

The same migration is committed to the repository in:

```text
supabase/migrations/20260812073421_fix_customer_document_delete_activity_on_customer_cascade.sql
```

Validation performed against the affected live customer inside a transaction:

```text
BEGIN;
DELETE customer;
confirmed delete_would_succeed = true;
ROLLBACK;
```

The rollback preserved the live customer while proving the exact deletion now succeeds at database level. No portal code deployment is required for this database-only hotfix.

## Existing Intermediary Migration Fix

**IMPLEMENTED / APPLIED / DEPLOYED:** the partial-save risk in `apps/web-portal/app/intermediaries/applications/[id]/existing-intermediary-migration-actions.ts` was removed. The action now calls the Supabase RPC `sync_existing_intermediary_migration(...)` instead of updating application draft JSON, profiles, assignments and registers through separate unchecked Supabase calls.

New migration:

```text
supabase/migrations/20260812120000_atomic_existing_intermediary_migration_sync.sql
```

Supabase project `ilzhsfqqjyppzzvfscmh` confirmed the function was applied on 2026-08-12 with signature:

```text
sync_existing_intermediary_migration(p_application_id uuid, p_actor_id uuid, p_migration jsonb, p_registration_status text)
```

The RPC updates, in one transaction:

- application `draft_data` and linked account `registration_status`
- `posp_misp_onboarding_profiles` Partner/POSP/MISP identifiers and raw migration data
- `partners.partner_code`
- `intermediaries.intermediary_code` / `onboarding_id`
- `intermediary_registrations.registration_code` and historical statuses
- `intermediary_training_exam_assignments` historical statuses

The RPC temporarily moves family intermediary/registration codes to generated `SYNC-*` values inside the transaction before writing final IDs. This is required so a correction can safely swap Partner and POSP/MISP IDs under unique indexes.

Affected live-family diagnosis for application `8cfae297-39d6-4f6a-aa09-5267177d6ed1` showed the draft migration values already differed from canonical Partner/profile/register rows. No direct data repair was run because the intended Partner ID vs POSP ID needs explicit confirmation from the user; re-saving the Existing Intermediary Migration section after confirming the visible values should invoke the new atomic sync.

Verification run:

```text
npm run typecheck  # passed
npm run lint       # passed with existing warnings only
npm run build      # passed after rerun with elevated spawn permission
```

Production deployment evidence:

```text
Fix commit: 33109ffd2ed089d56600cc09e7a7d435810a21ba
Production trigger commit: 0d48d1c750ec7d1e26697391e370eaecb36b5fed
GitHub Actions production run: 31581565649
Verification gate: success
Deploy hook job: success
Vercel deployment: dpl_6eBut6oTAU4r4KZJPrAtftMYmB96
Vercel state: READY
Vercel project: insureit
Production target: production
```

Supabase rollback-only RPC smoke test could not be completed because the SQL tool rejected the multi-statement transaction wrapper with `INVALID_ARGUMENT`; function installation was verified by querying `pg_proc`.

### Existing Intermediary Migration profile-ID swap hotfix

**APPLIED 2026-08-12:** live production retry for application `8cfae297-39d6-4f6a-aa09-5267177d6ed1` still failed when correcting the visible IDs to Partner `PT00003` and POSP `SIB/2026/05/0010`.

Root cause: the previous RPC temporarily moved `intermediaries.intermediary_code` and `intermediary_registrations.registration_code`, but did not temporarily move `posp_misp_onboarding_profiles.external_onboarding_id`. The profile table has a row-level duplicate trigger, so a valid parent/child family ID swap could still fail while a sibling profile retained the old target ID during the statement.

New migration:

```text
supabase/migrations/20260812153000_fix_existing_intermediary_profile_id_swap.sql
```

Supabase project `ilzhsfqqjyppzzvfscmh` recorded the migration as `20260812094322_fix_existing_intermediary_profile_id_swap`. Verification query confirmed the live function now includes:

- profile duplicate guard for Partner/POSP/MISP IDs outside the current family
- temporary `SYNC-*` move for `posp_misp_onboarding_profiles.external_onboarding_id`

No direct data repair was run. The deployed portal already calls the RPC, so the user should retry `Save & Exit` from the Existing Intermediary Migration section.

## Previous OCR Track

## Verified pre-change parser baseline

User-local baseline before the latest structured-table architecture work:

```text
IFFCO regression:    10/10 passed
Digit regression:     5/5 passed
New India regression: 5/5 passed
Typecheck:             passed
Lint:                  0 errors
Build:                 passed
```

Do not reuse this as proof that newer structured-table commits pass.

## Live production findings

Repeated live tests with IFFCO policy `N8109328` established:

- insurer detection fixed: IFFCO-TOKIO
- product fixed: Package
- policy number fixed
- IDV fixed
- valid from/upto fixed and apply correctly
- CPA later read correctly as 330
- flattened OCR premium interpretation remained unsafe, producing OD `1` and TP values such as `997134`/`22409`

Durable learning: flattened table reading order must not be used as the sole financial evidence.

Known correct accounting target:

```text
Basic TP 7267 + Legal Liability 100 = TP 7367
CPA = 330
Printed net = 22739
OD = 22739 - 7367 - 330 = 15042
```

## Current implementation

A second IFFCO financial pass consumes Google Document AI table cell anchors (`pages[].tables[]`) instead of relying only on flattened page text.

New file:

```text
apps/web-portal/lib/policy-ocr-iffco-structured-refiner.ts
```

Server action extracts structured table rows and runs the structured IFFCO refiner after the existing text refiner. The structured pass rebuilds OD/TP/CPA from labeled premium rows and only returns them when the complete financial equation reconciles to printed net. If evidence is incomplete, financial fields are withheld rather than guessed.

Regression:

```text
npm run policy-ocr:iffco-structured-regression
```

Relevant commits:

```text
a63604a773f5c2cdd5eaba08ada83cb0f125daec
6e3b37af37b254de367707f5d99cad96816c997b
f16058c0c159ec90f46d4b28a718d3205ab82a7b
1b5a19e8a31e7a2c7acf62510e3dcb7de94fbbf2
22d62f0387368ff8d0f1725321e0a286b2b9f5df
```

## Immediate next step

For deletion administration, use the dependency order claim -> policy -> vehicle -> customer when those linked records actually exist. If a dependency-free customer still fails deletion, inspect current Postgres logs before altering dependency rules. The customer-document activity cascade bug described above has already been fixed in production.

For OCR deployment, continue to follow the regression and explicit-deploy gate in `AGENTS.md`.

United India remains deferred.
