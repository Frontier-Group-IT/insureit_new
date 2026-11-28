# INSUREIT — 28 Nov 2026 remaining-intake grouped remediation

This is a living, source-constrained implementation handoff. Every intake state below was read from the connected production **Insureit_Web** queue and booking ledgers. No source premium, date, identity or transaction is deemed verified solely because a PDF extraction returned success.

## Current 12 (after SBI/Liberty group)
| Intake suffix | Latest queue / ledger | Root-cause lane | Next acceptance gate |
| --- | --- | --- | --- |
| 7A8864 | Go Digit 18/18, original uncertain, one-time recovery uncertain | Transaction reconciliation | Prove ledger/canonical transaction outcome; **no further automatic retry** |
| E99B5C | Go Digit 18/18, original uncertain; no recovery; no saved draft | Transaction reconciliation | Current source, no-commit proof and canonical identity; **no generic retry** |
| C33977 | UIIC 18/18, original uncertain; UIIC recovery review_required/canonical_booking_review | Canonical review | Resolve precise canonical validation and compare source/draft; don't replay original uncertain claim |
| 99C758 | New India 16 checks, manufacturer_unmatched + CPA unverified | Source CPA / manufacturer | Certify printed owner-driver CPA, underlying liability split, GST and canonical make |
| F2898D | National 18 checks, owner-driver CPA unverified | Source CPA | Certify explicit positive CPA or waiver from original schedule and its correct liability/tax split |
| 863F68, 7222F7 | ICICI 13/13, vehicle_ownership booking holds | Existing vehicle/coverage | Reconcile existing chassis, ownership and overlapping policy; no bypass |
| 50714A | Failed identity, gross/net, mixed IGST/stamp checks | Source identity / tax | Source-specific schedule evidence for each failed check |
| 22A977 | Failed printed registration, make/model, fuel | Source identity | Verify complete registered plate and manufacturer model/fuel; no inferred series |
| 4B0769 | Shriram issuance not verified | Source issuance | Verify issuance from insurer's approved original date evidence; do not substitute arbitrary PDF creation |
| 434AFC | Unsupported Oriental two-wheeler package | Unsupported layout | Train scoped Motor product family with positive and negative original-PDF replays |
| BE2DDA | Unsupported Non-Motor | Unsupported product | Separate Non-Motor parser and canonical booking contract; not a Motor rule extension |

## Implemented in this PR
A reusable read-only gate is applied to **both** the AI queue reprocess action and the explicit current-PDF draft reparse action. It consults the original claim and all current one-time recovery ledgers. Any `claimed`, `uncertain`, `booked`, unreadable or unavailable ledger blocks reprocessing **before** altering queue/draft evidence. Only a pure `review_required` claim remains eligible for the pre-existing, separately authorized source-only reparse path.

## Reusable rules for subsequent implementation
1. Detection is by insurer + product + versioned source layout; never expand a global permissive regex from one document.
2. Each field carries its extracted value, PDF evidence anchor, parser/version, current source-document ID/fingerprint, and confidence/verification status.
3. Financial validation independently checks OD, TP, owner-driver CPA, additional liability, net, each printed tax component and gross; `CPA = 0` requires explicit insurer-source waiver or positive zero evidence.
4. Separate extraction success from canonical booking readiness. Booking still requires master identity, insurer/product validity, current source fingerprint, customer/vehicle/ownership, overlaps, duplicates, authorization and atomic ledger claim.
5. An uncertain claim is a reconciliation task, not a retry task. Never clear the original ledger or reset parser/queue evidence until recovery has been independently resolved and the workflow explicitly allows it.
6. Test each new layout with de-identified positive fixtures, negative swaps of identity/model/issue date/CPA/tax, and existing insurer-family regression coverage. A real current-PDF replay is still required before publishing.
7. Permit a new insurer/product branch only after the corresponding website eligibility and canonical money adapter have passed CI. Publish the matching n8n node and manually deploy the tested website commit in a controlled release.
8. Do not modify the nine historic excluded Tata AIG claims, existing registered policies or reviewer-owned drafts.

## Remaining source evidence
Original policy PDFs (or readable, verified original n8n execution text and document fingerprint) are needed to certify the specific premium/CPA, issuance, identity, Oriental and Non-Motor layouts. The connected database has queue metadata, not the legally meaningful original source statements. Do not mark any of these cases auto-bookable without the source and canonical evidence.

## Release gate
- This PR is only the non-destructive ledger safety prerequisite; **it does not auto-book any of the 12**.
- Verify standard GitHub web-portal CI and guard regressions.
- Review and merge; manual production deployment remains separate.
- Do not change production queue states or claim functions as part of this PR.
