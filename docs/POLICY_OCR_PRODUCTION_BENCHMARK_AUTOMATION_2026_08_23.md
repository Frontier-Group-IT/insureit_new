# Policy OCR Production Benchmark Automation — 2026-08-23

> Status: IMPLEMENTED ON FEATURE BRANCH / NOT YET APPLIED OR DEPLOYED.
>
> This document records the production-driven benchmark workflow added after the 22-policy training phase. It supplements `docs/INSUREIT_POLICY_OCR_AUTOMATED_TRAINING_SKILL.md` and `docs/POLICY_OCR_TRAINING_HANDOFF_2026_08_22.md`.

## Purpose

Move OCR training selection away from random policy copies and toward production impact while preserving blind holdouts and privacy-safe tracking.

The workflow must answer four questions continuously:

1. Which insurer/layout families are actually most common in production?
2. Which high-volume families are under-represented in approved OCR training?
3. What did the current parser return before any new parser change?
4. Did a later parser change improve fresh siblings/holdouts rather than only the trained copy?

## Verified production baseline used to design the selector

At analysis time the production database contained 591 motor policies. The five highest-volume insurers were:

1. National Insurance Company Limited — 205 policies.
2. United India Insurance Company Limited — 119 policies.
3. Go Digit General Insurance Limited — 57 policies.
4. IFFCO-TOKIO General Insurance Company Limited — 53 policies.
5. Magma General Insurance Limited — 43 policies.

Together these represented 477 / 591 policies (about 80.7%). Counts are a point-in-time production observation; the automated selector recalculates the mix for each new run rather than hardcoding these numbers.

Important data-availability learning: National Bundled TWP was the largest single production family at 129 policies but had no stored PDF in `policy_documents` at analysis time. Treat this as a document-availability gap, not a parser failure. The selector therefore chooses the highest-volume family for each top insurer that has enough fresh stored PDFs for the requested cohort.

## Implemented workflow

Migration `20260823145000_add_policy_ocr_production_benchmarks.sql` introduces service-role-only benchmark metadata:

- `policy_ocr_benchmark_runs`
- `policy_ocr_benchmark_items`
- `create_policy_ocr_production_benchmark_run(...)`

The selector:

- recalculates production volume by insurer + policy type + vehicle segment;
- ranks the top five insurers by current production count;
- chooses each insurer's highest-volume family that has enough stored fresh PDF policy copies;
- excludes approved training copies;
- excludes documents already used in an earlier benchmark run;
- records only a one-way public tracking key in the operator UI;
- marks a family with at least four approved samples as `blind_holdout`;
- marks less-covered families as `training`;
- records production count, PDF availability, approved sample count and priority score.

The protected page `/system/policy-ocr-training` is available only through the existing IT Super User OCR-training authorization. It can:

- create a production benchmark cohort;
- show selected insurer/layout families without displaying real policy identifiers;
- process the next two baseline policies through the existing Google Document AI + INSUREIT parser path;
- snapshot parser ID/version, proposal, extraction method and failure state into benchmark metadata;
- show training-vs-holdout and baseline progress.

Baseline batches are deliberately small because the existing Document AI call has a long per-document timeout. Do not replace this with a large synchronous loop that risks one Vercel function timing out and losing progress.

## Security and privacy boundaries

- No operational policy/customer/vehicle record is modified by the benchmark workflow.
- Benchmark selection may create missing `policy_ocr_training_labels` queue metadata for stored policy copies; this is training metadata only.
- Raw PDFs remain in private storage.
- Raw OCR text is not stored in the benchmark tables.
- Storage bucket/path and signed download URLs are not copied into benchmark metadata.
- Real policy numbers, registration, chassis and engine identifiers are not displayed on the control page.
- `policy_ocr_benchmark_runs` and `policy_ocr_benchmark_items` have RLS enabled and no anon/authenticated access; the server uses the service role after the existing IT Super User authorization check.
- The benchmark public key is a one-way SHA-256-derived tracking value and is not the database document UUID.

## Measurement discipline

A baseline proposal is not PDF truth. After the baseline is captured, the training workflow must still classify PDF-vs-reference-vs-parser results using the durable taxonomy:

- MATCH / exact
- ROUNDING_EQUIVALENT
- REFERENCE_CONFLICT
- TABLE_ASSOCIATION_ERROR
- SEMANTIC_ERROR
- OCR_MISSING
- INSUFFICIENT_EVIDENCE
- routing error

Do not compute a formal accuracy percentage from database-reference comparison alone when the database reference conflicts with the actual policy PDF.

## Current deployment state

The feature branch/PR contains the migration and application code only. Until explicitly merged, migrated and deployed:

- benchmark tables/functions do not exist in production;
- `/system/policy-ocr-training` is not a usable production page;
- no benchmark run has been created by this implementation;
- no operational or training production data has been written by the feature branch itself.

After explicit approval, apply the migration through the normal migration workflow and deploy the exact verified commit. Then create the first production benchmark and capture baseline results before modifying parser logic.
