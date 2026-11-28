# INSUREIT — Issued Policy Record-Keeping Import Rule

## Purpose

**Business decision, 28 November 2026:** The Operations Portal is registering a record of policies that the insurer has **already issued**. It does not issue, modify, endorse or validate coverage with the insurer. Do not require the insurer to produce another document solely to satisfy a convenience field in the record.

**Import objective:** extract as many source-supported fields as possible, preserve the insurer's PDF, and reconcile *printed* OD, liability, applicable tax, net and **total payable**. Fields absent from the schedule remain **not stated**; neither zero premiums nor coverage waivers may be fabricated.

**Still enforced:** true policy/document identity, source fingerprint/current PDF, unique booking transaction and duplicate/idempotency checks, customer and vehicle identity/ownership checks, internal authorization, and canonical database integrity. An uncertain previous transaction is reconciliation-only, never a fresh automatic booking attempt. The nine previously excluded Tata AIG recoveries stay excluded.

## New India GCV — 99C758
- Printed Make/Model is `TATA INTRA V30 TRUCK`; separate Variant says `INTRA V40 LX`. Use the labelled Make/Model as the normalized record model and keep both original values in the attached source. This is **not** a claim that V40 is invalid or that insurer coverage should change. Source ambiguity alone need not prevent *record* import when the unique chassis and premium are consistent.
- Printed gross ₹24,480 = net ₹22,514 + mixed IGST ₹1,966. OD ₹6,365 + TP ₹16,149 = net. Basic TP ₹16,049 + paid-driver LL ₹100 = TP. Invoice 18% base ₹6,465 and 5% base ₹16,049 independently account for the tax. The zero *separately charged* owner-driver CPA does not assert an actual waiver.
- Keep registration `MP-21` as a partial, unregistered reference, not a registered plate.

## National GCV — F2898D
- Printed OD ₹1,723.04 + legal liability ₹27,186 + paid-driver ₹100 = ₹29,009.04. Insurer's printed **net** is ₹29,009: record an explicit **−₹0.04 rounding adjustment**, not a new premium.
- Invoice first line ₹1,823.04 (OD + paid driver) ×18% → ₹328; second ₹27,186 ×5% → ₹1,359; IGST ₹1,687; gross ₹30,696. A missing separately itemized owner-driver CPA charge is **0 charged**; the insurer's generic CPA wordings do not prove or disprove actual coverage.
- Canonical Motor form has no rounding-adjustment field, so it receives `OD ₹1,723.00 / TP ₹27,286 / CPA ₹0`, totalling ₹29,009. The unrounded `OD ₹1,723.04` and invoice remain attached to the exact original PDF; the PDF remains authoritative.
- This mapping applies **only** when the server has re-read the original full PDF and independently verified each invoice row, liability component, tax and payable. A missing/inconsistent invoice keeps the record in review. This is not a global CPA-zero exemption or premium tolerance relaxation.

## Future intake rule
A future instance of either supported source-layout family follows the same extraction and record-import rules; it does not require another manual training session. A genuinely different PDF layout or unresolvable canonical identity failure retains its precise exception reason. This does not relax unrelated insurer parsers or affect stored legacy policies.
