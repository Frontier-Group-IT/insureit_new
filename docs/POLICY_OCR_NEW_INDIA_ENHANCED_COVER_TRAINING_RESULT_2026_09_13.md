# New India Commercial Vehicle Package – Enhanced Covers OCR Training Result

Date: 2026-09-13
Status: **IMPLEMENTED / NOT YET VERIFIED / NOT MERGED / NOT DEPLOYED / NOT LIVE VERIFIED**

## Scope

This training round is intentionally limited to The New India Assurance Company Limited `Commercial Vehicle Package Policy – Enhanced Covers` layout. It reuses `new_india_motor_v1`; no new insurer parser was introduced.

## Failure classes addressed

- `TABLE_ASSOCIATION_ERROR`: Section 02 page-one vehicle table was only partially surfaced.
- `SEMANTIC_ERROR`: final TP value was being normalized as printed Total TP minus owner-driver CPA even though this Enhanced Covers layout prints CPA inside Total TP.
- `INSUFFICIENT_EVIDENCE`: short registration-region text such as a state/RTO prefix must not be promoted into a complete vehicle registration number.

## Implemented parser/refiner changes

New final scoped refiner:

- `apps/web-portal/lib/policy-ocr-new-india-enhanced-covers-refiner.ts`

It is invoked at the end of the approved-layout pipeline so that this exact New India layout has final authority over its vehicle and premium semantics without changing other New India layouts.

### Section 02

For the proven Enhanced Covers layout the refiner now attempts to recover:

- Vehicle Make from explicit `Make/Model` evidence.
- Vehicle Model separately from the same cell.
- Manufacturing year.
- Vehicle class normalized to `GCV` only when Goods Carrying/Public Carrier wording is explicit.
- GVW as vehicle capacity.
- Chassis and Engine as separate identifiers from the explicit `Chassis no./Engine no.` row/cell.
- Fuel from `Type of fuel`.
- RTO state from `Name of registration authority` when the printed value is state-level evidence.

A short regional code is explicitly prevented from becoming a complete registration number or registration-status proof.

### Section 03

For this exact layout:

- `Total OD Premium` is authoritative for OD, with `Calculated OD Premium` as a bounded fallback.
- `Total TP Premium` is authoritative for TP, with `Calculated TP Premium` as a bounded fallback.
- Owner-driver CPA remains separately surfaced.
- CPA is **not subtracted** from printed Total TP for this layout.
- `OD + printed Total TP = printed Net Premium` must reconcile within tolerance before TP is accepted.
- If direct TP evidence is missing or accounting fails, TP is withheld rather than guessed.

This preserves the legacy lower-level New India behavior for other New India layouts while correcting final semantics only for `Commercial Vehicle Package Policy – Enhanced Covers`.

## Privacy-safe regression coverage

New regression:

- `apps/web-portal/scripts/policy-ocr-new-india-enhanced-covers-regression.ts`

Coverage includes:

1. Sanitized trained layout with explicit vehicle table and premium totals.
2. Fresh sibling with different synthetic identifiers, make/model, GVW, fuel and premiums.
3. Chassis/Engine split and whitespace compaction.
4. Make/Model split.
5. Printed Total TP remains authoritative even when CPA is separately present.
6. OD + TP = Net reconciliation.
7. Non-reconciling printed TP is withheld.
8. Short registration-region evidence is not promoted into a full registration number.
9. Non-Enhanced-Covers New India layout remains unchanged by the new refiner.

The canonical web verification workflow now includes a dedicated `New India Enhanced Covers regression` step.

## Evidence ledger

- Training plan PR: `#1767`
- Training plan merge SHA: `e9a2f594ca7520bdabd9f9d07c6b7f488539ca73`
- Implementation branch: `ocr-training/new-india-enhanced-covers-2026-09-13`
- Feature head: pending final PR state
- Verification run: pending
- Merge SHA: pending
- Production deployment run / deployment ID: pending
- Live replay: pending

## Required next evidence

Before changing this status to VERIFIED or MERGED:

1. Open a PR from the implementation branch.
2. Run the full canonical `Verify web portal` workflow against the exact PR head.
3. Confirm the dedicated New India Enhanced Covers regression, all existing OCR regressions, typecheck, lint and production build are green.
4. Merge only with explicit user approval.
5. Deploy only with explicit user approval.
6. Replay the source policy in production and record actual Section 02/03 output before claiming LIVE VERIFIED.
