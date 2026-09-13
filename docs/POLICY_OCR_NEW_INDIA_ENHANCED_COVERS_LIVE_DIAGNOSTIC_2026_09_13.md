# New India Enhanced Covers — Live OCR Diagnostic Round

Date: 2026-09-13

## Status

**IMPLEMENTED ON FEATURE BRANCH / NOT MERGED / NOT DEPLOYED**

Branch: `ocr-training/new-india-live-diagnostic-trace`

This round intentionally does **not** add another speculative parser rule. It instruments the exact production OCR/refiner boundary so the next live replay can establish where Manufacturing Year, Chassis Number and Engine Number disappear.

## Production symptom

For the repeatedly tested New India Commercial Vehicle Package Policy — Enhanced Covers document, the live review modal continues to return the already-stable fields such as fuel, make/model, GVW/capacity, RTO state, vehicle class and Section 03 values, but it does not return:

- `vehicle_manufacturing_year`
- `vehicle_chassis_number`
- `vehicle_engine_number`

The source policy itself contains these values. The review UI also explicitly supports these three keys. Therefore the remaining defect is before the UI receives `parsed.fields`.

## Why previous rounds were insufficient

Previous PRs added structured-table, flattened-text, wrapped-identifier and table-neighborhood recovery and their synthetic regressions passed. Live production replay still omitted the same three fields. This proves that green synthetic regressions do not reveal the exact Google Document AI evidence shape for the real request.

The server currently returns final parser fields and discards the raw provider response after deriving `pages[]` and `tables[]`. Historical production requests therefore cannot be reconstructed safely after the fact.

## Diagnostic added

`apps/web-portal/lib/policy-ocr-approved-layout-refiner.ts` now emits a privacy-safe JSON log for `new_india_motor_v1` after the final New India residual stage.

Message key:

`policy_ocr_new_india_diagnostic`

The diagnostic records only structural facts:

- generated non-document trace ID
- parser ID and parser version
- whether Enhanced Covers routing matched
- whether page 1 contains Vehicle Details, Year label and Chassis/Engine label
- count of plausible year candidates
- count of VIN-shaped and other mixed identifier candidates
- total Layout Parser table count and page-1 table count
- whether table cells contain the Year and Chassis/Engine labels
- whether Manufacturing Year / Chassis / Engine existed immediately before and after the final residual refiner

It does **not** log raw OCR text, policy number, registration number, customer identity, actual year value, chassis, engine, table contents, addresses, phone numbers or any other source-document identifiers.

## Regression protection

`apps/web-portal/scripts/policy-ocr-new-india-separated-identifiers-regression.ts` now captures the diagnostic on a privacy-safe synthetic policy and verifies:

- the structural flags/counts are present;
- the diagnostic confirms successful post-refiner fields for the synthetic case;
- synthetic chassis and engine values are absent from the log;
- unrelated document text is absent from the log.

This regression remains inside the canonical New India Enhanced Covers gate.

## Required live replay after deployment

After this diagnostic release is explicitly approved, merged and deployed, re-read the same New India policy once. Then inspect Vercel production logs for `policy_ocr_new_india_diagnostic` around that request.

Interpretation:

- `enhancedLayoutMatched=false` → fix layout gating, not field extraction.
- Year/identifier labels absent in page text → provider/native-PDF reading boundary is the issue.
- Layout tables absent or label cells absent → stop assuming Layout Parser table structure for this family.
- Evidence present but `afterResidual` fields false → exact parser/refiner bug.
- `afterResidual` fields true but review modal still omits them → investigate result serialization/return boundary.

Only after this measured replay should another parser rule be introduced.

## Privacy rule

Do not expand this diagnostic to include raw provider text or real vehicle/customer identifiers. Any future fixture derived from the live result must remain synthetic while preserving only the observed structural failure shape.
