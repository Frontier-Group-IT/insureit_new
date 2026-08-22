# Policy OCR 22-policy layout training matrix — 2026-08-22

## Ground-truth rule

For this training round, the actual policy PDF is the final source of truth when an approved/verified database reference conflicts with the document. A conflicting verified reference must not be taught back into parser logic.

Operational policy, customer, vehicle and premium records are not modified by this training work.

## Parser architecture

Training is organized as:

`insurer -> current-policy product/layout family -> bounded extraction rules -> financial reconciliation -> review`

A parser family must not use a previous insurer or previous/active liability policy reference as the current insurer/policy identity.

## Layout families covered in v5

| Insurer | Layout family | Portal product | Key semantics |
| --- | --- | --- | --- |
| United India | GCV package | Package | Basic TP is separate from liability additions; owner-driver CPA requires explicit evidence. |
| United India | PCV package | Package | Passenger/paid-driver liability additions do not imply owner-driver CPA. |
| United India | Motorized 3-wheeler GCV liability only | Third Party | IDV/OD are zero; split 5%/18% IGST is summed; paid-driver liability stays distinct from owner-driver CPA. |
| HDFC ERGO | Private car package/comprehensive | Package | Portal TP is net liability less explicit owner-driver PA; current HDFC identity wins over previous-insurer text. |
| HDFC ERGO | Two-wheeler standalone OD | SAOD | Active TP policy is a separate reference and must not replace current policy number or TP amount. |
| HDFC ERGO | Two-wheeler liability only | Third Party | Liability and explicit owner-driver PA are normalized separately. |
| National Insurance | GCV package | Package | Bilingual table values require structured/bounded evidence and reconciliation. |
| National Insurance | Private car liability only | Third Party | IDV/OD are zero; legal liability and personal accident rows are distinct. |
| National Insurance | Two-wheeler OD with long-term Act | Bundled | One-year OD period is current Section 03 validity; printed premium is reconciled against liability/CPA. |
| New India Assurance | Private car standalone OD | SAOD | Total IDV and current OD period are preferred over component/previous references. |
| Royal Sundaram | Private car liability only | Third Party | Paid-driver liability does not imply owner-driver CPA. |
| Magma General | Private car standalone OD | SAOD | Current SAOD identity and current period override previous package references. |
| Magma General | Private car package | Package | IDV, OD, liability, owner-driver PA, CGST/SGST and gross are parsed from the current schedule. |
| Magma General | Commercial vehicle liability only | Third Party | IDV/OD are zero; Basic TP, paid-driver addition and split IGST are distinct. |
| Go Digit | Private car package | Package | Total Act premium is normalized by separating explicit owner-driver PA; net/GST/gross reconcile. |

## Generalization rules

- Detect the insurer from current-policy header evidence, not any previous-insurer section.
- Detect product/layout from stable policy-title/UIN/schedule wording rather than exact customer or premium values.
- Prefer Layout Parser tables for table relationships, with bounded page-text fallback for fields that Google emits outside tables.
- Prefer current policy number and current policy period; reject previous policy, active TP, quote, proposal, invoice and transaction references.
- Preserve review warnings when a required field cannot be supported safely.
- Withhold rather than guess when financial reconciliation fails.
- Never commit raw policy PDFs, OCR dumps, names, contact data, registration, engine or chassis identifiers.

## Verification requirement

Synthetic regressions model the failure shapes only. A green regression does not make a layout live-verified. After deployment, representative real policies — including fresh same-layout copies — must be re-run through Google OCR and reviewed before describing a layout as live verified.
