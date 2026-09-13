# New India Commercial Vehicle Package – Enhanced Covers OCR Training Plan

Date: 2026-09-13
Status: ANALYSIS / TRAINING PLAN ONLY — NOT IMPLEMENTED, NOT MERGED, NOT DEPLOYED

## Source policy type

The analyzed source document is a New India Assurance commercial vehicle package policy using the `Commercial Vehicle Package Policy – Enhanced Covers` layout, UIN `IRDAN190RP0044V01100001`.

## Ground-truth observations from source policy

Page 1 vehicle table contains:
- Year of manufacture: 2026
- Commercial vehicle type: A - Goods Carrying
- Subtype: Other than 3 wheeler - Public Carrier
- Chassis no.: 926956D0212046
- Engine no.: MEC881HCGTP207105
- Fuel: Diesel
- Body type: Open
- GVW: 55000
- Make/Model: BHARATBENZ / 5532
- Registration no.: RJ-45
- Seating capacity including driver: 3
- Variant: 5532T 4X2
- Registration authority: RAJASTHAN
- IDV: 5,558,450

Page 2 premium schedule contains:
- Basic OD: 14,391
- Additional premium for GVW above 12000KG: 1,741.50
- Towing coverage: 1,500
- IMT 23 loading: 2,419.85
- Nil Depreciation Cover Premium: 23,764.30
- Premium for enhancement cover: 23,764.30
- Calculated / Total OD Premium: 41,397
- Basic TP: 44,242
- Owner-driver CPA: 275
- LL paid driver/conductor/cleaner: 150
- Calculated / Total TP Premium: 44,667
- Net Premium: 86,064
- GST: 9,740
- Total Payable: 95,804

Accounting identity for this layout:
`41,397 OD + 44,667 TP = 86,064 net`.
CPA is already included within the printed Total TP for this New India schedule and must not be added again when reconciling net premium.

## Live OCR review result observed

Correct/proposed:
- Fuel: Diesel
- Vehicle model: BHARATBENZ/5532
- Insurer: The New India Assurance Company Limited
- Product: Package
- Policy number: 31280031260300001917
- Valid from: 2026-09-12
- Valid upto: 2027-09-11
- IDV: 5,558,450
- CPA amount: 275
- OD premium: 41,397
- TP premium: 44,392 (incorrect)

The displayed TP result is under by 275. The policy's authoritative `Total TP Premium` is 44,667, comprising Basic TP 44,242 + CPA 275 + LL paid driver 150. The parser appears to have included Basic TP + LL but excluded CPA from the TP total while also surfacing CPA separately.

## Section 02 incomplete fields

The source policy visibly contains vehicle fields that were not surfaced by the observed review result:
- registration number
- manufacturing year
- vehicle class / subtype
- GVW
- RTO / registration authority
- chassis number
- engine number
- vehicle make (separate from model)

The current output has only Fuel and a combined Make/Model value in `vehicle_model`.

## Section 03 issue

The main confirmed financial error is TP semantics. For this layout, the authoritative TP field must come from `Calculated TP Premium` / `Total TP Premium`, not reconstructed as Basic TP + selected liability additions while excluding CPA.

The policy's CPA amount should continue to be surfaced separately as `cpa_premium = 275`, but accounting reconciliation must avoid adding that CPA a second time because the printed New India `Total TP Premium` already includes it.

## Targeted training plan

1. Reuse the existing `new_india_motor_v1` parser/refiner; do not create a generic replacement.
2. Add a strict layout gate for New India `Commercial Vehicle Package Policy – Enhanced Covers`, supported by UIN / title / premium schedule structure.
3. Parse the page-1 vehicle table structurally by labels, keeping Chassis and Engine as separate slash-delimited values only within the explicit `Chassis no./Engine no.` row.
4. Split `Make/Model` into `vehicle_make` and `vehicle_model` only for this explicit cell; preserve variant separately only if the current OCR field contract supports it.
5. Extract registration number, year, vehicle class/subtype, GVW and registration authority from their explicit table cells.
6. For financials, prefer `Total OD Premium` and `Total TP Premium` (or the identical calculated totals) over arithmetic from nearby rows.
7. Preserve `CPA amount = 275` as a separate semantic field while treating it as already included in Total TP for reconciliation.
8. Require `OD + Total TP = Net Premium` for this layout before accepting financial totals.
9. Add negative guards so `Basic TP`, LL paid-driver amount, CPA amount, GST rates, SAC and enhanced-cover premium cannot be mistaken for Total TP.
10. Add a sanitized trained fixture plus at least one fresh sibling fixture with changed identifiers, vehicle values and premiums.
11. Add regressions for Engine/Chassis split, Make/Model split, TP-includes-CPA semantics, missing Total TP withholding, and unrelated New India layouts remaining unchanged.
12. Run the full canonical web verification before merge; merge/deploy only on explicit user approval.

## Documentation continuity rule

For every completed OCR parser training round, update durable markdown handoff documentation with:
- insurer + exact layout/product scope
- source-policy truth used for training
- parser/refiner path changed
- failure classification
- fields fixed / intentionally withheld
- trained fixture and fresh-sibling coverage
- exact PR/head SHA
- canonical verification run ID/result
- merge SHA
- production deployment run/deployment ID
- live replay result, including remaining misses
- distinction between IMPLEMENTED / VERIFIED / MERGED / DEPLOYED / LIVE VERIFIED

Do not record real customer PII, full policy numbers, registration/chassis/engine identifiers, raw OCR dumps or secrets in committed regression fixtures. This analysis document contains source-derived identifiers only because it is currently on an analysis branch and must be sanitized before any merge.