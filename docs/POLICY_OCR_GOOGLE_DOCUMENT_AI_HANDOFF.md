# Policy OCR and Google Document AI Handoff

> **Consolidated:** 2026-08-09 (IST)
>
> Source of truth for Policy Onboarding OCR. Never store credentials, tokens, raw OCR text, complete policy documents, policyholder PII, vehicle identifiers, or secrets here.

## 1. Approved scope

Policy OCR may propose only Section 03 fields:

- Policy product
- IDV / sum insured
- OD premium
- Third-party premium
- CPA opted / amount
- Policy number
- Insurance company
- Valid from / upto

Printed net, GST/tax and gross premium are comparison-only. OCR must never populate customer/vehicle identity fields. Review-before-apply is mandatory.

## 2. Google / INSUREIT architecture

Google Document AI remains the reading layer. INSUREIT owns insurer detection, interpretation, accounting normalization, confidence and warnings.

Current server flow:

```text
Policy PDF/image
 -> Next.js server action
 -> Vercel OIDC / Google WIF
 -> Enterprise Document OCR processor
      -> flattened page text for insurer/product/policy/IDV/dates/comparison totals
 -> for supported IFFCO PDFs only: dedicated Layout Parser processor
      -> Document.documentLayout.tableBlock rows/cells
 -> insurer-specific semantic mapping
 -> accounting reconciliation gate
 -> review modal
 -> selected Section 03 fields applied
```

The Layout Parser is a separate processor. Do not assume Enterprise Document OCR returns the Layout Parser `documentLayout` tree.

Primary files:

- `apps/web-portal/app/policies/policy-ocr-actions.ts`
- `apps/web-portal/lib/policy-ocr-parsers.ts`
- `apps/web-portal/lib/policy-ocr-iffco-refiner-v2.ts`
- `apps/web-portal/lib/policy-ocr-iffco-structured-refiner.ts`
- `apps/web-portal/lib/policy-ocr-digit-refiner-v2.ts`
- `apps/web-portal/lib/policy-ocr-new-india-refiner.ts`
- `apps/web-portal/components/policy-ocr-import-panel.tsx`

Production Google identity remains Vercel OIDC Workload Identity Federation with short-lived service-account impersonation. No service-account JSON key is used.

## 3. Production Google processors

Existing Document OCR processor:

```text
Name: insureit-policy-ocr
ID: 84d0facf88efc0d7
Type: Document OCR
Region: us
```

Dedicated Layout Parser created by the user on 2026-08-09:

```text
Name: insureit-policy-layout
ID: b630ad846c5137a1
Type: Layout Parser
Region: us
```

The application supports optional `GOOGLE_DOCUMENT_AI_LAYOUT_PROCESSOR_ID`; when absent it currently falls back to the verified project processor ID above. The processor ID is configuration metadata, not a credential. Do not store secrets or service-account keys in repository files.

## 4. Verified parser baseline before dedicated Layout Parser change

User-local verification on 2026-08-09 after the first structured-refiner implementation:

```text
IFFCO structured regression: 2/2 passed
IFFCO text regression:      11/11 passed
Digit regression:            5/5 passed
New India regression:        5/5 passed
Typecheck:                    passed
Lint:                        0 errors / warnings only
Next.js build:                passed
```

This proves the semantic/accounting refiner baseline, but it does not verify the new second-call Layout Parser integration. Run the same checks again after the dedicated Layout Parser wiring commit before another release.

## 5. Production learning from IFFCO N8109328

**VERIFIED LEARNING:** flattened OCR text is not reliable enough to assign IFFCO premium-table columns by proximity alone. Live Google OCR correctly recovered insurer, Package product, policy number, IDV, dates and later CPA, but flattened premium interpretation produced unsafe values including OD `1`, TP `997134`/`22409`, where `997134` is table metadata/SAC rather than a premium.

Correct rule:

- Never accept a financial field only because a nearby number follows `Net(A)` / `Net(B)` in flattened reading order.
- Use the dedicated Layout Parser's `Document.documentLayout.tableBlock` structure for premium-table rows.
- Use labeled liability rows plus accounting reconciliation.
- If the Layout Parser call fails, returns no usable table rows, or the financial set cannot be proven, withhold OD/TP/CPA instead of auto-applying flattened guesses.

Known N8109328 accounting target:

```text
Basic TP = 7267
Legal Liability to Driver = 100
CPA = 330
TP = 7367
Printed net = 22739
OD = 22739 - 7367 - 330 = 15042
```

## 6. Structured IFFCO financial pass

**IMPLEMENTED IN REPOSITORY / NEW DEDICATED LAYOUT PROCESSOR PATH NOT YET DEPLOYED OR LIVE-VERIFIED**

Behavior:

1. Enterprise OCR remains the first call and provides page text for the existing insurer-specific parser.
2. If the detected family is IFFCO and the upload is a PDF, the server makes a second authenticated call to the Layout Parser processor `b630ad846c5137a1`.
3. The request enables Layout Parser table annotation.
4. The server reads `document.documentLayout.blocks[].tableBlock`, preserving table rows and cell contents.
5. Existing IFFCO text refiner still owns insurer/product/policy/IDV/dates and printed comparison totals.
6. Structured pass rebuilds OD/TP/CPA from premium-table rows.
7. For the current IFFCO family it uses:
   - `Basic TP Premium`
   - `Legal Liability to Driver`
   - `P.A. Owner Driver`
   - independently parsed printed net
8. Financial values are returned only when `OD + TP + CPA = printed net` within tolerance.
9. If structured tables are unavailable/incomplete or do not reconcile, all IFFCO OD/TP/CPA fields are removed and Review Required is returned.

Relevant dedicated-Layout commits:

```text
ed48f4d46fef535a35d626850b97026c8251e373  Fail safe when IFFCO structured tables are unavailable
e49b3ac94adc5051a2a2ef9c39847b92b71e86c3  Use dedicated Layout Parser for IFFCO premium tables
```

Earlier structured-refiner commits remain part of the history:

```text
a63604a773f5c2cdd5eaba08ada83cb0f125daec  Add structured IFFCO table financial refiner
1b5a19e8a31e7a2c7acf62510e3dcb7de94fbbf2  Add structured IFFCO regression
22d62f0387368ff8d0f1725321e0a286b2b9f5df  Add structured regression command
```

Regression command:

```text
npm run policy-ocr:iffco-structured-regression
```

The synthetic regression covers:

- repairing the production-shaped bad state `OD=1 / TP=22409 / CPA=330` from structured rows to `15042 / 7367 / 330`;
- withholding all financial fields when structured CPA evidence is missing.

## 7. Existing insurer scope

Supported pure-motor families remain:

- IFFCO-TOKIO commercial motor
- Go Digit commercial motor
- The New India Assurance commercial motor

### Multi-insurer training increment - 2026-08-14

**IMPLEMENTED / DEPLOYED:** the first non-IFFCO training increment adds detection, semantic refinement, sanitized regression fixtures, and CI coverage for five additional insurer families represented by the user's supplied policy copies:

- Shriram General motor package schedule
- The Oriental Insurance Company motor package schedule
- National Insurance bilingual Goods Carrying Vehicle package schedule
- Universal Sompo motor bundled/private-car schedule
- United India PCV package schedule

Files:

```text
apps/web-portal/lib/policy-ocr-additional-motor-refiner.ts
apps/web-portal/scripts/policy-ocr-additional-regression.ts
apps/web-portal/lib/policy-ocr-parsers.ts
apps/web-portal/app/policies/policy-ocr-actions.ts
apps/web-portal/package.json
.github/workflows/verify-web-portal.yml
docs/POLICY_OCR_TRAINING_PLAN_2026_08_13.md
```

Behavior:

- New family IDs: `shriram_motor_v1`, `oriental_motor_v1`, `national_motor_v1`, `universal_sompo_motor_v1`, `united_india_motor_v1`.
- The additional refiner owns insurer, product, policy number, dates, IDV, comparison totals, and financial fields when labeled evidence reconciles.
- Financial values are accepted only when `OD + TP + CPA` reconciles to printed net premium within tolerance.
- If labeled OD/TP/CPA evidence is incomplete or unreconciled, the refiner withholds OD/TP financial fields and returns a review warning instead of guessing.
- National bilingual GCV fixtures intentionally cover an unsafe flattened premium-table shape; the parser keeps safe header/totals and withholds unreconciled OD/TP.
- Sanitized regression fixtures use synthetic policy numbers and no customer/vehicle identity values.

Verification:

```text
npm run policy-ocr:additional-regression
Additional insurer OCR regression: 5/5 cases passed.

npm run policy-ocr:all-regressions
IFFCO structured regression: 5/5 cases passed.
IFFCO regression: 11/11 cases passed.
Digit regression: 5/5 cases passed.
New India regression: 5/5 cases passed.
Additional insurer OCR regression: 5/5 cases passed.

npm run typecheck
passed

npm run lint
passed with existing warnings only

npm run build
passed with existing warnings only
```

The GitHub `verify-web-portal.yml` gate now includes `npm run policy-ocr:additional-regression` before typecheck, lint, and build.

Remaining work:

- Run real Google Document AI upload checks for each supplied sample in a protected environment and compare against the sanitized expectations.
- Add layout-table refiners for National/Oriental/Shriram if real Document AI table output remains ambiguous.
- Confirm Universal Sompo bundled-product mapping with the business owner before treating private-car bundled policies as fully supported in production.
- Complete authenticated upload/review/apply tests with the supplied real policy PDFs before claiming full live OCR journey verification.

Production deployment evidence:

```text
Feature commit: bec9938b27bf4a2ee667ca5c1c0aad0426d65d44
Production trigger commit: 4f075cb8b0f2c7f034bcf8a0f475f4499e16cc95
GitHub Actions production run: 31733565073
Verification gate: success
Deploy hook job: success, Vercel response HTTP 201, job tefhOzPVay0jNLNPV0Fr
Vercel deployment: dpl_VdesEUrHCNQ2EATHjTQEUqQvqJE5
Vercel state: READY
Vercel URL: insureit-10jo5y5f9-antnish1s-projects.vercel.app
Production alias: portal.insureit.in
Production smoke: unauthenticated GET /policies/new returned 307 to /login?next=%2Fpolicies%2Fnew.
Runtime errors: no error/fatal logs found for deployment dpl_VdesEUrHCNQ2EATHjTQEUqQvqJE5 in the checked post-deploy window.
```

### OCR date/premium hotfix - 2026-08-14

**IMPLEMENTED / DEPLOYED:** live testing of the additional-insurer OCR flow showed two concrete issues after the first deployment:

- extracted ISO validity dates such as `2025-08-14` were applied into the visible `DD/MM/YYYY` mask, producing malformed values such as `20/25/0814`;
- flattened OCR values near CPA/GST labels could promote small table, percentage or reference tokens such as `1`, `2`, `5`, `15`, `18` or `28` into Section 03 fields or comparison totals.

Fix:

- `components/policy-ocr-import-panel.tsx` now applies OCR validity dates through the hidden native `type=date` control behind the formatted input, so React form state remains ISO and the visible UI displays `DD/MM/YYYY`.
- `lib/policy-ocr-additional-motor-refiner.ts` now rejects non-numeric policy-number labels, blocks tiny/reference CPA candidates unless the value is explicit zero or a realistic premium, filters GST percentage/reference values, and derives printed GST from gross minus net when direct OCR tax evidence is unsafe.
- `scripts/policy-ocr-additional-regression.ts` now includes the observed Shriram real-layout premium shape plus negative fixtures for National GST `5%`, National IMT `28`, and United India `Policy Number : CUSTOMER`.

Verification:

```text
Fix commit: 4eed29c3efcc393c8df750cc3579347cfb4d19f1
GitHub verification run: 31735620677, success
Local checks: policy-ocr:all-regressions, typecheck, lint, build passed
Production trigger commit: 86d2d3d9c7e61ecf3512e754c780fa57446e772e
GitHub production run: 31735852329, verification gate success and deploy hook success
Vercel deployment: dpl_2oCyiTgMGWvV5SdUoUFifSyZWUSF
Vercel state: READY
Vercel URL: insureit-qq5rirujv-antnish1s-projects.vercel.app
Production alias: portal.insureit.in
Production smoke: unauthenticated GET /policies/new returned 307 to /login?next=%2Fpolicies%2Fnew.
Runtime errors: no error/fatal logs found for deployment dpl_2oCyiTgMGWvV5SdUoUFifSyZWUSF in the checked post-deploy window.
```

### Shriram schedule-block OCR fix - 2026-08-14

**IMPLEMENTED / DEPLOYED:** user retesting of the Shriram sample showed IDV, OD premium and TP premium still missing from the review modal. The parser was relying on generic label-near-money extraction, while the observed Shriram schedule splits `OD TOTAL`, `TP TOTAL`, `TOTAL PREMIUM`, and `PREMIUM AMOUNT` labels and values across separate lines.

Fix:

- `lib/policy-ocr-additional-motor-refiner.ts` now uses a Shriram-specific schedule-block reader for `SCHEDULE OF PREMIUM`.
- The Shriram block reader extracts OD, TP, printed net premium and gross premium from the bounded schedule block and derives GST from gross minus net.
- The existing reconciliation rule remains mandatory: OD + TP + CPA must match printed net premium before OD/TP are proposed.
- IDV evidence lookahead was widened so split IDV headers can still reach the numeric total value row.

Verification:

```text
Fix commit: 9b4d2d49c56771e5ef765522acf138e3b0359bb7
Production trigger commit: 8ec61c661118c44561d5fbcec7b052514776187b
GitHub verification run before trigger: 31771556248, success
GitHub production run: 31771718845, verification gate success and deploy hook success
Local checks: policy-ocr:all-regressions, typecheck, lint, build passed
Vercel deployment: dpl_2RvQNqDj1zNrKGSiawn56by49Vvv
Vercel state: READY
Vercel URL: insureit-20ktj8zes-antnish1s-projects.vercel.app
Production alias: portal.insureit.in
Production smoke: unauthenticated GET /policies/new returned 307 to /login?next=%2Fpolicies%2Fnew.
Runtime errors: no error/fatal logs found for deployment dpl_2RvQNqDj1zNrKGSiawn56by49Vvv in the checked post-deploy window.

Latest production supersession: later production trigger `91f4b283e950408f54a10019225683d2eaa381e2` for PR #338 also contains the Shriram OCR fix in its history. GitHub production run `31772022480` passed, Vercel deployment `dpl_Fy2fj4vPmZfpepXzbSLrr1jh7cLK` reached READY, `portal.insureit.in` was aliased to it, unauthenticated `/policies/new` returned the expected 307 login redirect, and no error/fatal runtime logs were found in the checked post-deploy window.
```

Expected Shriram retest behavior for the observed sample: IDV, OD premium, TP premium, printed net premium, GST and gross premium should be available in the review modal when Google OCR returns the same schedule labels. If any value is still withheld, inspect sanitized Google OCR output around `SCHEDULE OF PREMIUM` before broadening extraction.

United India Miscellaneous/Special Type Vehicles and Contractors Plant & Machinery remain deferred unless representative samples and approved Section 03 mapping are provided.

### New India enhanced-cover schedule training - 2026-08-19

**IMPLEMENTED / LOCALLY VERIFIED:** a supplied New India commercial vehicle package policy exposed a second schedule shape. Its extracted text uses `Period of cover`, `Total Value`, same-line `Total OD Premium`/`Total TP Premium`, `Net Premium`, `GST`, `Total Payable`, and a split owner-driver CPA label whose amount appears several lines later.

The New India refiner now supports these bounded labels and preserves accounting normalization:

```text
OD = 10272
Printed TP/liability = 48921
CPA = 275
Portal TP = 48921 - 275 = 48646
OD + Portal TP + CPA = 59193
```

The sanitized New India regression now covers this layout and passes 6/6 cases. Full OCR regressions pass: IFFCO structured 5/5, IFFCO 11/11, Digit 5/5, New India 6/6, and additional insurers 5/5. Typecheck, lint, and build passed with existing warnings. The actual uploaded PDF was checked locally using extracted text; Google production upload/review/apply remains **UNVERIFIED** until the same policy is re-uploaded through the authenticated production portal after an approved deployment.

### Oriental bundled and IFFCO standalone-OD training - 2026-08-19

**IMPLEMENTED / LOCALLY VERIFIED:** two additional supplied policies were trained with sanitized regressions:

- Oriental two-wheeler bundled cover: product `Bundled`, dates `2026-08-13` to `2027-08-12`, IDV `75233`, OD `302`, TP `3851`, CPA `0`, printed net `4153`, GST `748`, gross `4901`.
- IFFCO-Tokio private-car standalone OD: product `SAOD`, synthetic regression policy number `N8100001`, dates `2026-07-29` to `2027-07-28`, IDV `900000`, OD `3618`, CPA `0`. Third-party premium is intentionally withheld because the policy identifies HDFC ERGO as the external TP insurer; printed net `11863`, GST `2135.34`, and gross `13998.34` remain comparison-only.

Parser changes include Oriental final OD/TP schedule-row selection and bundled mapping, IFFCO split-line P400 number extraction, SAOD detection, safe CPA handling from the explicit no-owner-driver declaration, premium-bifurcation totals, and server-side bypass of package-only Layout Parser financial replacement for SAOD. Sanitized regression results: Oriental/additional insurers `6/6`; IFFCO `12/12`. Full OCR regressions, typecheck, lint, and build passed locally with existing warnings. Production upload/review/apply remains **UNVERIFIED**.

Release evidence:

```text
MERGED: PR #430, merge commit ca88d047
DEPLOYMENT TRIGGERED: commit 5707cf93
GitHub production workflow: 32225200436, success
Verification gate: passed before deploy hook
Vercel deploy hook: HTTP 201, job PTcdBtBm5dDI9ttcGJKz, state accepted/pending
Production smoke: https://portal.insureit.in/login returned HTTP 200 and the INSUREIT sign-in page
Vercel dashboard READY state: UNVERIFIED from available evidence
Authenticated OCR upload/review/apply: UNVERIFIED
```

## 8. Release discipline / next steps

Ordinary commits do not intentionally deploy production. Do not modify `.deploy/production-trigger.json` unless the user explicitly says `deploy now` or `finish and deploy` after the current code change.

Before deployment of the dedicated Layout Parser integration, run:

```text
npm run policy-ocr:iffco-structured-regression
npm run policy-ocr:iffco-regression
npm run policy-ocr:digit-regression
npm run policy-ocr:new-india-regression
npm run typecheck
npm run lint
npm run build
```

After explicit deployment approval, verify the exact Vercel production commit and upload the same real IFFCO policy again. Target financial result: OD `15042`, TP `7367`, CPA `330`. If Layout Parser does not supply usable rows, expected safe behavior is Review Required with OD/TP/CPA withheld, not guessed.

## 9. Automated premium training workflow — 2026-08-21

**IMPLEMENTED / NOT YET APPLIED OR DEPLOYED:** `20260821153000_premium_ocr_training_workflow.sql` queues the existing policy-copy backlog and future inserts/replacements. The server worker claims at most three jobs with leases/`SKIP LOCKED`, allows three attempts with controlled retry timing, and stores only Section 03 proposal values, bounded evidence labels, confidence, parser metadata and sanitized warnings.

The `/policies/ocr-training` queue compares Google proposals against the existing saved Section 03 values from `policies` and `policy_premium_details`; manual re-entry is not required. It shows match/missing/review results, keeps private copies in a new tab through a short-lived authorized URL, and lets an authorized reviewer confirm the database reference for the existing owner-approval flow. Exhausted jobs can be manually re-queued by reviewer or approver roles without raising the automatic three-attempt safety limit. Owner approval still creates a sanitized candidate with a synthetic policy number and never edits parser code.

Automatic execution uses a protected Vercel cron plus best-effort post-upload/reviewer-page scheduling. `POLICY_OCR_WORKER_SECRET` or Vercel `CRON_SECRET` must be configured privately before deployment. The queue reads tracked `policy_documents` rows rather than arbitrary Storage objects; `20260821220000_link_legacy_policy_copies_to_ocr.sql` safely links older `customer_documents` policy copies only when the policy match is unambiguous. The worker now checks Google configuration and the OIDC subject token before claiming jobs, so missing infrastructure configuration does not burn retry attempts. Migration application, live backlog processing, authenticated two-person review and candidate inspection remain **UNVERIFIED**.

### Queue-count incident and corrected migration order

**LEARNING / VERIFIED FROM PRODUCTION UI:** the reviewer page reported 281 linked policy copies but only nine queue rows. The page is correct to render only documents that have a related `policy_ocr_training_labels` row; it does not scan the Storage bucket.

The required migration order is:

```text
202608210001_policy_ocr_training_labels.sql
  -> creates the label table
20260821153000_premium_ocr_training_workflow.sql
  -> adds queue state/triggers/worker functions and backfills labels for existing policy_documents
20260821220000_link_legacy_policy_copies_to_ocr.sql
  -> links only unambiguous legacy customer_documents uploads
```

The first production migration workflow applied the first and third files but skipped the second. That left the database with many `policy_documents` rows but only labels created by earlier events, explaining `All · 9` and the exhausted “Not proposed” rows. Applying the legacy-link migration alone cannot create labels because the queue trigger and backfill are defined in the skipped premium workflow migration.

PR #523 corrected `.github/workflows/apply-supabase-migrations.yml` to apply and record all three layers. The next agent must run the workflow and query live counts before claiming repair:

```sql
select count(*) from public.policy_documents where document_type = 'policy_copy';
select count(*) from public.policy_ocr_training_labels;
select processing_status, count(*) from public.policy_ocr_training_labels group by processing_status;
```

The easier long-term design is one idempotent server-side sync function/RPC that links eligible legacy copies, inserts missing labels with `on conflict do nothing`, and returns reconciliation counts. Run it once through the protected migration workflow; let a protected cron process small batches. The page should remain read-only and show a diagnostic when tracked documents exceed queue labels. Never infer the queue from a Storage listing or consume retry attempts before Google/OIDC preflight succeeds.

The first rerun after PR #524 exposed a second migration-order mistake: `20260821153000` had bundled inserts into `public.access_permissions_v2`, but that table is absent from the remote migration set. PR #525 removed the unrelated permission block, and Supabase workflow `32513044974` then completed the queue migration, backfill and legacy linking successfully. Idempotent verification workflow `32513396428` reported `policy_copy_documents=286`, `queue_labels=286`, `pending_jobs=286`, `ready_jobs=0`, `exhausted_jobs=0`. Keep permission catalog changes in a separate migration only after the remote access-control schema is confirmed. If the UI still shows nine after a hard refresh, inspect which deployment/project the browser is using; the live queue itself is no longer nine.

## 10. Automatic queue draining and Section 03 comparison — 2026-08-22

**IMPLEMENTED ON FEATURE BRANCH / NOT YET MERGED OR DEPLOYED:** the worker now loads the linked policy and `policy_premium_details` reference after Google OCR succeeds, writes only the approved Section 03 reference fields into the existing training-label row, and runs one shared comparison classifier used by both the server worker and reviewer UI.

Comparison rules:

- policy numbers ignore formatting separators but not characters;
- dates compare ISO and `DD/MM/YYYY` representations;
- Package/Comprehensive, SAOD/Standalone Own Damage and supported TP synonyms normalize to canonical product families;
- currency values tolerate at most ₹2 difference;
- missing OCR, missing database reference, mismatch and match are separate states;
- an exact match means every Section 03 value that is actually stored in the database was also proposed and matched.

The reviewer queue adds an `Exact match` filter and summarizes mismatch/missing counts. Exact matches still require reviewer confirmation and separate owner approval. Automation never overwrites Policy Onboarding Section 03, never self-approves a candidate and never edits parser source.

The Vercel cron changes from once daily to hourly and keeps the established batch cap of three documents. `POLICY_OCR_WORKER_BATCH_SIZE` may reduce the batch but cannot raise it above three. With 286 pending documents, the nominal drain time is about four days, subject to Vercel cron timing, Google quotas and retry delays.

Deployment requirements:

- the Vercel project must be on a plan that supports sub-daily cron schedules (Pro or Enterprise); Hobby rejects this schedule;
- `CRON_SECRET` or `POLICY_OCR_WORKER_SECRET` must remain configured privately;
- Vercel Secure Backend Access/OIDC must remain enabled so each function receives `x-vercel-oidc-token` for Google WIF;
- after deployment, inspect cron runtime logs and verify queue counts move from pending to ready/failed without exhausted retries caused by configuration;
- run one authenticated reviewer journey and inspect exact-match and mismatch behavior before claiming production completion.

**CI learning:** PR #525 intentionally removed the OCR queue migration's dependency on the optional `access_*_v2` database tables, but the access-control static regression still expected those permission rows inside that migration. The regression now treats the two OCR permissions as application-only compatibility entries until the remote Access Control V2 schema is confirmed, while explicitly failing if the queue migration reintroduces any `access_permissions_v2`, `access_roles_v2` or `access_role_permissions_v2` dependency.

### Worker scheduling finding — 2026-08-22

All 286 jobs remained `pending` at attempt `0/3`, proving that no worker had claimed them yet. The prior cron was daily and the route supplied only the request OIDC header; when that header was absent, the server correctly returned `google_oidc_subject_token_missing` before claiming work. The route now falls back to server-only OIDC environment values and the cron is hourly, while the safe worker limit remains three jobs per invocation. This fix is **IMPLEMENTED / NOT YET DEPLOYED**. A production check must observe a job transition from `pending` to `processing` and then `ready` or an explicit failure before OCR processing is considered live.

## 11. Phase 1 operator-controlled execution — 2026-08-22

**SUPERSEDES THE AUTOMATIC-DRAINING DESIGN ABOVE / IMPLEMENTED ON DRAFT PR #530 / NOT DEPLOYED:** policy copies no longer run because of an upload, page visit or Vercel cron. The cron route and schedule are removed. An authorized reviewer/approver chooses one queue row and clicks **Run with Google Cloud** (or **Re-run with Google Cloud**).

The selected-run Server Action independently re-authenticates the caller and requires either `review_policy_ocr_training` at edit level or `approve_policy_ocr_training` at approve level. It then preflights Google configuration and the Vercel OIDC subject token before changing queue state. A separate cron/worker shared secret is not required because Phase 1 has no external worker route or scheduler. The processor uses an optimistic compare-and-set on the exact selected label ID, creates a short lease and processes only that label's linked private `policy_copy`. Concurrent clicks cannot claim another queued policy or claim the selected label twice. A failed row advances only when the operator clicks again and remains capped at three attempts; an explicit re-run of a ready or exhausted row starts a fresh controlled cycle. Provider/parser failures remain visible on that row. Upload/replacement still creates or resets the queue label through the existing database trigger, but it does not invoke Google.

**IMPLEMENTED AFTER PRODUCTION DIGEST `3201635344` / DEPLOYMENT PENDING:** the first Phase 1 deployment incorrectly retained the retired worker-secret preflight in the operator action. Production had no `POLICY_OCR_WORKER_SECRET` or `CRON_SECRET`, so every manual click threw a generic Next.js application error before Google configuration/OIDC was checked. The corrected action authorizes the operator directly, retains Google/OIDC preflight before claim, and returns pending/success/error state inline instead of throwing expected operational failures into the route error boundary.

Section 03 comparison, review-before-approval, separate owner approval and sanitized candidate safeguards remain unchanged. Vehicle/identity extraction is not included. The exact Section 02 form/payload/database map and the gate for the next increment are documented in `docs/POLICY_OCR_SECTION_02_FIELD_MAP.md`.
