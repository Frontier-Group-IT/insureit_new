# New India Enhanced Covers OCR — Live Residual Training — 2026-09-13

Status: **IMPLEMENTED / NOT YET VERIFIED / NOT MERGED / NOT DEPLOYED**

## Scope

This follow-up is intentionally restricted to the existing `new_india_motor_v1` family for **Commercial Vehicle Package Policy - Enhanced Covers**. It follows the production replay of PR #1768.

## Production replay result after PR #1768

The live replay materially improved this policy type. The following fields were confirmed as working in the review UI:

- Fuel = Diesel
- Vehicle Make = BHARATBENZ
- Vehicle Model = 5532
- Vehicle capacity / GVW = 55000
- RTO state = Rajasthan
- Vehicle class = GCV
- insurer, product, policy number and dates
- IDV = 5558450
- CPA = 275
- OD premium = 41397
- TP premium = 44667 (printed Total TP, no CPA subtraction)

The remaining supported Section 02 misses were:

- Manufacturing year = 2026
- Chassis number
- Engine number

The source policy is final truth. In the source schedule the relevant evidence is `Year of manufacture: 2026` and the combined `Chassis no./Engine no.` value. The Engine value is line-wrapped in the PDF/OCR text, which is the failure shape this round targets.

## Failure classification

This is a **TABLE_ASSOCIATION / LINE-WRAP RESIDUAL**, not an insurer-routing or financial-semantics failure. The correct New India parser is already active and the financial fields are now correct.

## Training strategy

A narrowly gated post-Enhanced-Covers residual refiner is added after the existing New India Enhanced Covers refiner. It:

1. only runs for `new_india_motor_v1` with explicit New India + Enhanced Covers title evidence;
2. fills Manufacturing Year only when currently absent;
3. recovers separately labelled Chassis / Engine values from structured table evidence when available;
4. handles a combined `Chassis no./Engine no.` cell and preserves the left/right semantic order;
5. compacts OCR whitespace inside vehicle identifiers only after the label/table association is proven;
6. never overwrites already-good Year, Chassis or Engine values;
7. leaves Make/Model, GVW, RTO, class and all premium semantics untouched;
8. continues to withhold incomplete registration evidence such as `RJ-45`.

## Privacy-safe regression requirements

The regression uses synthetic identifiers and must cover:

- year label/value split across structured cells;
- combined Chassis/Engine label with values in a neighbouring cell;
- Engine value broken by OCR whitespace/line wrapping;
- fresh sibling with changed year and identifiers;
- no overwrite of already-correct identifiers;
- unrelated New India layouts unchanged.

## Evidence states

- IMPLEMENTED: candidate residual refiner exists on feature branch.
- VERIFIED: pending canonical `Verify web portal` exact-head run.
- MERGED: pending explicit approval after green verification.
- DEPLOYED: pending explicit deployment approval.
- LIVE VERIFIED: requires replay of the same policy in production after deployment.

## Continuity rule

Future agents should update this document (or append a clearly dated successor) with PR number, exact head SHA, canonical verification run, merge SHA, production deployment ID, and post-deployment replay result. Do not claim the residual fixed from synthetic CI alone.
