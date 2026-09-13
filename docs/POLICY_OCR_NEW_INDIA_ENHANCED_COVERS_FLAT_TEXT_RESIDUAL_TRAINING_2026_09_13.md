# New India Enhanced Covers OCR — Flat-Text Residual Training — 2026-09-13

Status: **IMPLEMENTED / NOT YET VERIFIED / NOT MERGED / NOT DEPLOYED**

## Why this round exists

PR #1769 added a structured-table residual pass for the remaining New India `Commercial Vehicle Package Policy - Enhanced Covers` Section 02 misses.

Evidence from that round:

- canonical verification run: `34749120979` — success;
- merge SHA: `8a4e050bb32d0b9e8a40c2033e74ece0c38dc64b`;
- protected production deploy workflow: `34749290329` — success;
- Vercel deployment: `dpl_8U5u16KuERR3eecqnPUWEHKxtSKm` — READY;
- production alias: `portal.insureit.in`.

A live replay of the same policy after that deployment showed that the previously corrected fields remained good, including Make, Model, GVW, RTO state, vehicle class, IDV, OD, printed Total TP and CPA. However, the three residual Section 02 fields were still not proposed:

- Manufacturing Year = `2026`;
- Chassis Number;
- Engine Number.

This means PR #1769 was **DEPLOYED but not LIVE VERIFIED as a fix for these three residuals**.

## Failure classification

The failure is now classified as a **LIVE OCR FLATTENING / STRUCTURE-LOSS RESIDUAL**.

The prior regression proved the parser could recover the fields when Document AI exposed the vehicle table as structured label/value cells. Production replay proved the real document can instead expose the same evidence only through flattened page OCR. Therefore another structured-only rule would not address the real failure mode.

This is not an insurer-routing, premium-accounting, Make/Model, GVW or RTO failure.

## Scope

This round continues to reuse `new_india_motor_v1` and is restricted to explicit New India + `Commercial Vehicle Package Policy - Enhanced Covers` evidence.

It must only fill missing:

- `vehicle_manufacturing_year`;
- `vehicle_chassis_number`;
- `vehicle_engine_number`.

It must not alter already-proven Make, Model, Fuel, GVW, RTO, vehicle class, policy fields, IDV, OD, TP or CPA.

## Training strategy

The residual refiner keeps structured layout evidence as the first priority. Only if those three fields remain missing does it inspect a bounded raw OCR block between `VEHICLE DETAILS` and `INSURED DECLARED VALUE` / the premium schedule.

The raw fallback:

1. anchors Manufacturing Year to `Year of manufacture` and accepts only a four-digit 19xx/20xx value;
2. anchors identifiers to the combined `Chassis no./Engine no.` label first;
3. preserves left/right Chassis-to-Engine meaning across the slash separator;
4. tolerates OCR line breaks and spaces inside the Engine identifier only after the combined field association is proven;
5. supports separately labelled Chassis or Engine only as a later fallback;
6. rejects unbounded global proximity searching;
7. never overwrites an already-populated Year, Chassis or Engine value;
8. continues to withhold incomplete registration evidence such as `RJ-45`.

## Privacy-safe regression coverage

The canonical New India Enhanced Covers regression now includes a production-shaped flattened OCR fixture with:

- no structured table input;
- Year label and value on separate lines;
- combined Chassis / Engine label;
- Chassis and Engine separated by a slash;
- Engine identifier broken across multiple OCR lines and spaces;
- already-correct Make and TP fields that must remain unchanged;
- preservation guards for previously proven Year / Chassis / Engine values;
- unrelated New India layout protection.

All identifiers in the fixture are synthetic.

## Evidence states for this round

- **IMPLEMENTED:** flat-text fallback and privacy-safe regression are on the feature branch.
- **VERIFIED:** pending canonical exact-head `Verify web portal` run.
- **MERGED:** pending explicit user approval after green verification.
- **DEPLOYED:** pending explicit user approval.
- **LIVE VERIFIED:** requires another production replay of the same policy after deployment.

## Continuity rule

Do not treat synthetic CI success as proof that these three live fields are fixed. Future agents must append the PR number, exact head SHA, verification run, merge SHA, deployment ID and live replay outcome before promoting the evidence state to LIVE VERIFIED.
