# New India Enhanced Covers — Separated Vehicle Identifier Training

Date: 2026-09-13

## Scope

This training round is limited to `new_india_motor_v1` and the New India **Commercial Vehicle Package Policy - Enhanced Covers** layout.

## Production evidence

After the previous live-shape training was deployed, the production Policy Onboarding OCR review still omitted exactly three supported Section 02 fields:

- `vehicle_manufacturing_year`
- `vehicle_chassis_number`
- `vehicle_engine_number`

The same replay continued to return the previously trained fields correctly (fuel, make, model, GVW/capacity, RTO state, vehicle class, insurer, product, validity, IDV, CPA, OD and TP).

The review component already accepts all three missing keys, and the approved OCR pipeline already invokes the New India residual refiner. Therefore this round treats the remaining failure as a **Google OCR evidence-shape problem**, not a UI mapping problem and not an insurer-routing problem.

## Failure hypothesis

The combined `Chassis no./Engine no.` block may be flattened by Enterprise OCR without preserving a slash or same-cell adjacency. The previous residual rules expected either:

1. a structured table pair, or
2. a flattened pair still containing `/`.

When Google separates the two identifiers into different text fragments/cells, those rules safely withhold both fields.

The manufacturing year can suffer a similar association loss: the label is present, but the value is detached from the label in reading order.

## Targeted refinement

Added `policy-ocr-new-india-separated-vehicle-evidence-refiner.ts` as the final New India Enhanced Covers fallback.

Rules:

- Only runs for `new_india_motor_v1` + New India + Enhanced Covers.
- Never overwrites an already-proven Year/Chassis/Engine value.
- Manufacturing year is recovered only when the bounded Vehicle Details block contains the `Year of manufacture` label and exactly one plausible 19xx/20xx year.
- Chassis/Engine recovery is bounded to the text after the combined label and before the next vehicle-detail labels.
- Recovery does not require `/` to survive OCR.
- Exactly one 17-character VIN-shaped candidate is required for chassis.
- Exactly one other mixed alphanumeric identifier is required for engine.
- If evidence is ambiguous, values remain withheld.
- Short registration evidence such as `RJ-45` remains withheld as a full registration number.

## Regression

Added a privacy-safe synthetic regression reproducing:

- detached manufacturing-year label/value,
- engine and chassis on separate lines,
- no slash between identifiers,
- engine-like identifier first,
- 17-character chassis second,
- the already-correct OD/TP accounting.

The regression also checks that an ambiguous Vehicle Details block containing multiple years is not guessed by the new fallback.

## Evidence-state discipline

This document does not claim live success before production replay.

States for this round must be recorded separately as:

- IMPLEMENTED
- VERIFIED
- MERGED
- DEPLOYED
- LIVE VERIFIED

A green synthetic/canonical regression is **VERIFIED**, not LIVE VERIFIED.
