# INSUREIT CPA source-evidence batch (28 Nov 2026)

## Scope and release dependency
- Two originals were reviewed: New India CV package intake `99C758` and National GCV package intake `F2898D`.
- This change **does not book either policy**, update production ledgers, change customer/vehicle masters, relax duplicate/ownership/coverage gates, or modify unrelated insurer parsers.
- The matching New India n8n Code node has a **saved unpublished draft**. Merge the website code, manually deploy the exact merged commit, then source-replay and publish ONLY the New India parser change. Do not publish before verification.

## New India `99C758`: source facts
- OD ₹6,365, gross TP ₹16,149, net ₹22,514, IGST ₹1,966, payable ₹24,480.
- Page 2: Basic TP ₹16,049 + legal liability to paid driver ₹100 = total TP ₹16,149. Owner-driver PA nominee reads `none / 0 / none / none / none` and no separate CPA premium appears.
- Two independent printed IGST bases: ₹6,465 at 18% → ₹1,164; ₹16,049 at 5% → ₹802. The ₹6,465 base is OD ₹6,365 + paid-driver liability ₹100.
- New dedicated source family permits the **charged CPA amount** `0` only when all of these independent rows and totals are present and reconcile. This amount does **not** establish legal waiver coverage status in the abstract.
- **Separate blocking discrepancy on page 1:** Make/Model says `TATA INTRA V30 TRUCK`, while Variant says `INTRA V40 LX`. Do not silently select one or promote this intake to automatic booking; require an insurer-corrected schedule or reliable RC evidence with the canonical model/variant resolved.
- The exact cross-field contradiction is detected before sending the PDF to n8n. A new clear review diagnostic replaces a misleading CPA-only diagnosis after fresh reprocess.
- The production n8n parser remains unchanged until manually published. Historical original PDFs, fingerprints, queue and drafts are not automatically reprocessed.

## National `F2898D`: source facts
- Page 2: OD ₹1,723.04, Basic legal liability ₹27,186, paid-driver liability ₹100, printed net ₹29,009.00 (rounding difference ₹0.04).
- Page 6: ₹1,823.04 (OD plus paid-driver liability) at 18% → ₹328; ₹27,186 at 5% → ₹1,359; total IGST ₹1,687, payable ₹30,696.
- Page 7+ contains general owner-driver PA policy wording; the policy-specific schedule does not separately state an owner-driver CPA charge or explicit coverage waiver. An unrelated employer nominee on page 2 is **not** a CPA waiver.
- National GCV remains `extraction_only` and `booking_review_required`. Its current verifier must **not** emit a fabricated CPA `0` or canonical premium booking projection.

## Reusable future rules
1. Insurer + policy-product + printed schedule version determine parser routing.
2. Source evidence must establish coverage and price separately: `no CPA charge` and `CPA opted/waived` are different assertions.
3. New India zero-charge is allowed only with nominee-none **and** no positive PA charge **and** full TP / paid-driver and dual-GST reconciliation; a bare extracted 0 is rejected.
4. Contradictory make/model versus variant is a source identity hold, even when monetary sums pass.
5. Original source dates, manufacturer names, chassis, registration prefix and canonical booking remain validated independently.
6. Future new layouts require synthetic positive and negative test fixtures and an actual current-PDF replay before publication.
7. The nine excluded historical Tata AIG cases and previous supported insurer variants stay untouched.
