# New India Enhanced Covers OCR — Exact Live Shape Training — 2026-09-13

Status: **IMPLEMENTED / NOT YET VERIFIED / NOT MERGED / NOT DEPLOYED**

## Scope

This round remains inside the existing `new_india_motor_v1` parser family and is restricted to **New India Commercial Vehicle Package Policy - Enhanced Covers**.

It follows two production attempts that passed repository CI but did not fix the last three Section 02 fields in the same live policy:

- PR #1769 — structured-table residual recovery — **DEPLOYED / LIVE RESIDUAL STILL PRESENT**
- PR #1770 — bounded flattened-text residual recovery — **DEPLOYED / LIVE RESIDUAL STILL PRESENT**

The still-missing supported fields were:

- Manufacturing Year
- Chassis Number
- Engine Number

All previously corrected fields remained stable in production: Fuel, Make, Model, GVW/capacity, RTO state, vehicle class, insurer, product, policy number and dates, IDV, CPA, OD and printed Total TP.

## Evidence and failure classification

The actual source policy was re-inspected instead of inferring another synthetic layout. The source clearly prints:

- `Year of manufacture` with a four-digit year in the Vehicle Details block;
- a combined `Chassis no./Engine no.` cell;
- the combined identifier value split across an OCR line boundary.

A critical layout-specific semantic was identified: in this exact New India Enhanced Covers schedule, the combined value can contain an **engine-like identifier first** and a **17-character VIN-like chassis identifier second**, despite the literal combined label order. Therefore blindly assigning left side to Chassis and right side to Engine is unsafe for this layout.

Failure classification: **EXACT LIVE TABLE SEMANTICS + LINE-WRAP ASSOCIATION**, not insurer routing, OCR unreadability or premium accounting.

## Implementation strategy

The candidate v3 residual refiner:

1. remains hard-gated to `new_india_motor_v1` + explicit New India Enhanced Covers evidence;
2. never overwrites already-proven Year, Chassis or Engine values;
3. preserves structured-table extraction as first priority;
4. preserves bounded Vehicle Details text recovery as second priority;
5. adds a direct page-label fallback for `Year of manufacture` and the combined Chassis/Engine block;
6. normalizes line-wrap whitespace only after the combined-label association is proven;
7. when exactly one side of the combined pair is a 17-character alphanumeric VIN-like identifier, assigns that side to **Chassis** and the other side to **Engine**;
8. falls back to literal left/right label order only when VIN-shape evidence does not disambiguate the pair;
9. leaves Make/Model, GVW, RTO, class and all Section 03 financial semantics untouched;
10. continues to withhold incomplete registration evidence such as a short RTO-style registration fragment.

## Privacy-safe regression

A new exact-live-shape regression reproduces the real page-one reading order but uses synthetic identifiers and a synthetic policy number. It covers:

- year printed on the same line as another Vehicle Details field;
- engine-like identifier first in the combined cell;
- 17-character chassis identifier second;
- chassis split across an OCR line boundary;
- no structured layout tables available;
- preservation of existing Make, Model, GVW, RTO state and financial fields;
- incomplete registration remains withheld.

The new regression is chained into the existing `policy-ocr:new-india-regression` command so the canonical `Verify web portal` workflow cannot pass without it.

## Source-of-truth and privacy rule

The actual policy copy is the final truth, but raw customer identifiers, names, addresses, policy numbers, contact details, chassis numbers and engine numbers must never be committed to repository fixtures or durable docs. Only sanitized shape-equivalent evidence is allowed in regression code and handoff documents.

## Evidence states

- IMPLEMENTED: exact-live-shape candidate code and sanitized regression exist on the feature branch.
- VERIFIED: pending canonical exact-head `Verify web portal` run.
- MERGED: pending explicit user approval after verification.
- DEPLOYED: pending explicit deployment approval.
- LIVE VERIFIED: requires replay of the same policy in production after deployment.

## Continuity requirement

After verification/merge/deployment, append the PR number, exact feature head SHA, canonical verification run, merge SHA, Vercel deployment ID and live replay result. A green synthetic regression is not sufficient evidence to mark these fields live-fixed.
