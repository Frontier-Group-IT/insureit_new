# New India Enhanced Covers — structured vehicle evidence training

Date: 2026-09-13
Status at creation: IMPLEMENTED ON FEATURE BRANCH, NOT YET MERGED OR DEPLOYED

## Scope

Policy family: The New India Assurance Co. Ltd. — Commercial Vehicle Package Policy — Enhanced Covers.
Parser family: `new_india_motor_v1`.
Target residuals: Section 02 `vehicle_manufacturing_year`, `vehicle_chassis_number`, `vehicle_engine_number` only.

## Production replay finding

Repeated live replays after PRs #1769, #1770, #1771 and #1772 still omitted Manufacturing Year, Chassis Number and Engine Number while Make, Model, Fuel, GVW, RTO State, Vehicle Class and Section 03 financial values remained correct.

The Policy Onboarding review UI already accepts all three missing keys. The approved-layout pipeline also already invokes the New India residual refiner. Therefore the residual was not a UI filtering problem or a missing server-action import.

## Root cause

The previous residual refiner was page-text only. The source policy presents the vehicle data as a four-column table, where Layout Parser can retain stronger structure than Enterprise OCR page text:

- `Geographical Area / Zone | <value> | Year of manufacture | <year>`
- `Name of the Financier | <value> | Chassis no./Engine no. | <engine>/<chassis>`

The combined identifier value can also wrap after the slash, splitting the 17-character VIN-like chassis across OCR lines. Flattening the whole line before identifying slash boundaries can destroy the VIN shape.

## Training change

`policy-ocr-new-india-separated-vehicle-evidence-refiner.ts` now receives Layout Parser tables and applies this order:

1. Structured Vehicle Details table evidence.
2. Bounded page-text fallback only if structured evidence is absent.
3. Withhold on ambiguity.

For Manufacturing Year, an explicit structured `Year of manufacture` cell is authoritative when it yields exactly one plausible four-digit year.

For Chassis/Engine, the parser requires exactly one 17-character VIN-shaped candidate and one distinct engine-shaped alphanumeric identifier. It assigns semantic roles by identifier shape, not by assuming printed left/right order.

The refiner is versioned with `new-india-separated-vehicle-evidence-v5`.

## Regression coverage

The New India canonical regression now includes privacy-safe synthetic cases for:

- four-column structured Vehicle Details row;
- Engine-first / VIN-second combined identifier cell;
- VIN wrapped after the slash in flattened OCR;
- ambiguous flattened year evidence being withheld;
- explicit structured Year cell winning over ambiguous flattened text;
- incomplete registration evidence remaining withheld;
- already-correct OD/TP behavior remaining unchanged.

No real customer identifiers are stored in the regression.

## Evidence state discipline

Do not mark this round LIVE VERIFIED until the same production policy is re-read after deployment and the review modal visibly proposes Manufacturing Year, Chassis Number and Engine Number correctly.

Record separately: feature head, canonical verification run, PR, merge SHA, deployment workflow, Vercel deployment, and post-deployment replay result.
