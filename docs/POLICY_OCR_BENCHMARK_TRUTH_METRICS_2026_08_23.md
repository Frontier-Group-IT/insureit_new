# Policy OCR benchmark truth and measured-accuracy layer

Date: 2026-08-23

## Purpose

This layer turns a successful OCR baseline run into a measured benchmark without treating the operational database as ground truth.

The required hierarchy remains:

1. actual policy PDF;
2. approved insurer/layout semantics;
3. parser output;
4. Google OCR evidence;
5. database/reference values.

A database reference is therefore only a prefilled candidate. A reviewer must verify saved truth values against the private policy PDF before the benchmark reports measured accuracy.

## Cohort protection

Training items can enter PDF-truth review after the untouched baseline is captured.

Blind-holdout items are marked `sealed_holdout`. Their truth/reference values are not exposed by the benchmark truth page before post-training verification. This prevents the holdout from becoming another training example.

## Stored benchmark-only metadata

`policy_ocr_benchmark_items` gains:

- `truth_status`
- `truth_fields`
- `truth_source`
- `truth_verified_by`
- `truth_verified_at`
- `baseline_metrics`

Existing `result_classification` stores field-level baseline-vs-PDF-truth classifications.

No operational policy/customer/vehicle record is changed by truth review.

## Initial automatic classifications

- `MATCH_ALL`
- `ROUNDING_EQUIVALENT`
- `REFERENCE_CONFLICT`
- `OCR_MISSING`
- `SEMANTIC_ERROR`

`REFERENCE_CONFLICT` is counted as parser-correct when the parser agrees with verified PDF truth and the database reference does not.

The first automatic pass intentionally uses `SEMANTIC_ERROR` as the generic non-missing mismatch bucket. More specific root-cause clustering such as table-association or routing errors remains an engineering classification step and must not be invented from a value mismatch alone.

## Metrics

For fields explicitly saved as PDF truth:

- **Auto-fill precision** = correct auto-filled fields / auto-filled fields.
- **Auto-fill coverage** = auto-filled fields / PDF-truth fields.
- **Perfect-policy rate** = verified training policies where every truth field was correctly auto-filled.
- Reference conflicts, OCR-missing fields, and semantic mismatches are tracked separately.

No percentage is displayed when zero policies have verified PDF truth.

## Current benchmark rule

The Production Benchmark #1 baseline remains frozen at 20 policies:

- 16 training policies;
- 4 United India blind holdouts;
- 20/20 baseline-ready;
- 0 baseline failures.

The next allowed step is PDF-truth verification on the 16 training policies only. Parser refinement should begin only after enough truth has been verified to identify repeated insurer/layout failure clusters.
