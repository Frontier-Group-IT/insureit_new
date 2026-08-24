# Fresh 20-policy blind OCR result — 2026-08-24

## Sealed result

- Benchmark: `Fresh 20-policy multi-insurer sealed blind benchmark 2026-08-24`
- Frozen predictions: 20/20
- PDF truth verified: 20/20
- Capture failures: 0
- Precision: 80.4% (`267/332` auto-filled fields correct)
- Coverage: 68.7% (`332/483` expected fields auto-filled)
- Withheld or missing: 151
- Semantic errors: 65
- Perfect policies: 0/20

The final predictions were frozen before any holdout truth was revealed. Truth was entered from the private policy PDFs through the operator-only blind holdout flow. No raw policy identifiers, OCR text, document bytes, or customer data are included here or in regression fixtures.

## Highest-volume gaps

The largest missing-field groups were fuel type (16), OD premium (13), vehicle model (12), TP premium (11), manufacturing year (11), vehicle make (10), vehicle capacity (10), chassis number (9), and printed gross premium (8).

The largest semantic-error groups were vehicle make (9), printed GST (7), CPA premium (6), vehicle model (6), CPA opted (4), TP premium (4), vehicle capacity (4), and RTO state (4).

## Round 8 response

Round 8 keeps the precision-first guard and adds bounded recovery only from explicit printed schedule evidence:

- National bundled TWP: printed premium, legal-liability split, IGST, gross total, and no-payable-CPA state.
- United India GCV: explicit owner-driver CPA and split-tax/total-payable recovery while preserving the established Basic TP convention.
- IFFCO MISD: printed Net(A), Basic TP, zero owner-driver CPA, and the final total/tax/gross row.
- Magma PCP: explicit owner-driver CPA, paid-driver liability, and registration/date de-concatenation.
- HDFC ERGO TWP: spaced policy-number recovery plus printed GST and total-premium correction.

All new regression values are synthetic. The sealed result above remains immutable as the pre-training baseline; any later replay must be reported separately and must not overwrite the frozen prediction.
