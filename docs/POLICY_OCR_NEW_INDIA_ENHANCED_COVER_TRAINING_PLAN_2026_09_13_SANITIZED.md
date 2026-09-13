# New India Commercial Vehicle Package – Enhanced Covers OCR Training Plan

Date: 2026-09-13
Status: ANALYSIS / TRAINING PLAN ONLY — NOT IMPLEMENTED, NOT MERGED, NOT DEPLOYED

## Scope

This plan covers the New India Assurance `Commercial Vehicle Package Policy – Enhanced Covers` layout only. It is intended as a narrow extension of the existing New India OCR path, not a replacement parser.

## Live OCR result summary

Observed as correct/proposed in the review UI:
- Fuel type
- combined Make/Model text in the model field
- insurer
- product
- policy number
- policy dates
- IDV
- CPA amount
- OD premium

Observed incomplete/incorrect:
- several Section 02 vehicle fields are not surfaced even though the source table contains them
- Third Party premium is understated because the parser appears to exclude owner-driver CPA from the printed New India TP total while still surfacing CPA separately

## Layout semantics learned from the source document

Page 1 uses a structured vehicle table containing explicit cells for registration number, manufacturing year, commercial vehicle class/subtype, GVW, registration authority, chassis/engine pair, fuel, body type, Make/Model, seating capacity and variant.

Page 2 uses a premium schedule with authoritative calculated/total rows for OD and TP. For this layout, the printed TP total already includes the owner-driver CPA and other listed liability additions. Therefore:

- surface CPA separately as its own field when present
- use printed `Calculated TP Premium` / `Total TP Premium` as the authoritative TP value
- do not add CPA again during reconciliation
- reconcile `OD total + TP total = Net Premium`

## Targeted training plan

1. Reuse the current `new_india_motor_v1` parser/refiner.
2. Add a strict route for New India `Commercial Vehicle Package Policy – Enhanced Covers` based on current-policy title/UIN/layout evidence.
3. Parse the page-1 vehicle table structurally by exact labels.
4. Split the explicit `Chassis no./Engine no.` row into separate validated identifiers without cross-copying.
5. Split only the explicit `Make/Model` cell into vehicle make and vehicle model.
6. Recover registration number, manufacturing year, vehicle class/subtype, GVW and registration authority from their own cells.
7. Prefer printed `Total OD Premium` and `Total TP Premium` (or identical calculated totals) over nearby arithmetic.
8. Preserve CPA as a separate semantic field but treat it as included in TP for this layout's accounting.
9. Require `OD + TP = Net Premium` within tolerance before accepting financial totals.
10. Add guards against Basic TP, paid-driver liability, CPA, tax rates, SAC codes and enhanced-cover line items being mistaken for totals.
11. Add a privacy-safe trained fixture and at least one fresh sibling fixture with synthetic identifiers and changed monetary values.
12. Add regression cases for vehicle-table extraction, Engine/Chassis association, Make/Model split, TP-includes-CPA semantics, missing-total withholding and unrelated New India layouts remaining unchanged.
13. Run the complete canonical web verification before any merge/deployment.

## Durable documentation rule for future OCR training

Every completed parser-training round must append/update durable markdown documentation with:
- insurer and exact product/layout scope
- source-document truth used conceptually, without customer PII
- parser/refiner files changed
- failure class
- fields fixed and intentionally withheld
- trained fixture + fresh-sibling coverage
- PR number and feature-head SHA
- canonical verification run ID/result
- merge SHA
- production deployment workflow/deployment ID
- post-deployment live replay results and remaining misses
- explicit state: IMPLEMENTED / VERIFIED / MERGED / DEPLOYED / LIVE VERIFIED

Never commit raw policy PDFs/images, full OCR output, names, phone/email/address, PAN/GSTIN, real policy numbers, registration numbers, chassis/engine numbers, customer IDs or secrets into OCR fixtures or durable training docs.