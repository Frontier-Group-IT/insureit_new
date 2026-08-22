# Policy OCR insurer/layout matrix

> Updated: 2026-08-22
>
> This is a privacy-safe companion to `POLICY_OCR_GOOGLE_DOCUMENT_AI_HANDOFF.md`. It records parser architecture and supported layout families only. Do not add policyholder names, real vehicle identifiers, raw OCR dumps, or policy PDFs.

## Architecture rule

Motor OCR refinement is insurer-first and layout-second. A parser family must not assume that every document issued by the same insurer has the same structure. The layout router uses stable insurer headings plus policy/product titles, then applies bounded layout-specific extraction and financial normalization.

The production review-before-apply workflow remains unchanged. Parser output is still a proposal and must not silently write operational policy data.

## Current v4 layout families

| Insurer | Layout family | Product mapping | Key normalization |
| --- | --- | --- | --- |
| United India | `uiic_gcv` | Package | Gross OD, basic TP, gross TP, owner-driver PA evidence, separate UIIC GST components |
| HDFC ERGO | `hdfc_pcp` | Package | Net OD + net liability; subtract explicit owner-driver CPA from portal TP; package net/tax/gross |
| HDFC ERGO | `hdfc_twp_saod` | SAOD | Active TP policy references are ignored; TP/CPA are zero for the current SAOD policy |
| HDFC ERGO | `hdfc_twp_tp` | Third Party | IDV/OD zero; net liability, split GST and gross total |
| National Insurance | `national_gcv` | Package | Bilingual GCV schedule; paid-driver/cleaner liability is not owner-driver CPA |
| New India Assurance | `new_india_saod` | SAOD | Total IDV, total OD, net, GST and total payable; generic misclassification is promoted by exact insurer/layout evidence |
| Royal Sundaram | `royal_pcp_tp` | Third Party | Basic liability plus paid-driver liability; owner-driver PA remains separate and may be zero |
| Magma General Insurance | `magma_pcp_saod` | SAOD | New family promotion; OD-only current policy, separate liability reference, CGST+SGST reconciliation |

## Safety rules

- Current-policy number must win over previous/active liability policy references.
- Exact premium-table labels beat nearby-number heuristics.
- Percentages, NCB, IMT numbers, coverage sums and tax rates must not become premium values.
- CPA coverage/sum insured is not CPA premium.
- Paid-driver/workmen liability must not automatically imply owner-driver CPA opted.
- When the existing database reference conflicts with the policy document, do not train the parser to reproduce the conflicting reference. Preserve the discrepancy for manual/business review.
- If a financial decomposition cannot reconcile, withhold uncertain fields instead of guessing.
- All regression fixtures must use synthetic identifiers and privacy-safe values.

## Verification loop

For every supported layout, verification remains:

`real policy -> confirmed comparison -> layout-specific parser change -> synthetic regression -> all OCR regressions -> typecheck/lint/build -> PR -> deploy after approval -> same-policy production rerun`

A layout is not considered broadly supported merely because one sample passes. Add separate layout families whenever an insurer changes document type or premium semantics materially.
