# INSUREIT policy parser contract — extraction to one-click booking

## Tata AIG 18-check issuance mapping — explicitly approved 25 November 2026

Only for the four trained Tata AIG 18-check native-PDF layouts: a distinct, unambiguous printed **Policy Issue Date / Date of Issue** is the preferred issuance date. If absent, the user has specifically approved treating the PDF-printed **Receipt Date** as the operational issuance date, provided all 18 checks pass (including `receipt_date_document_consistent` and policy-number receipt agreement). Preserve the evidence label `Tata AIG printed Receipt Date (approved issuance rule)` and the informational warning `tata_aig_receipt_date_as_issuance`. This mapping is a business decision, not evidence that the PDF independently labels its receipt as issuance. Printed conflicting issue dates stop conversion; receipt, signature or coverage dates never override a separately printed issue date. Do not apply to ICICI, Tata TP-only or other insurers. Canonical date-approval/OTP, customer identity, policy and vehicle duplicates, finance reconciliation, reviewer scope and explicit user confirmation still apply. No unattended policy registration.


## Product behavior (applies to EVERY existing and future n8n insurer parser)

**Expected UX:** Upload a policy PDF → extraction → source-specific checks → queue **Verified** if all mandatory booking evidence is present → one explicit **Convert to Policy** confirmation → existing canonical booking transaction → policy code on success. Do **not** require **Reprocess PDF**, **Reparse & Replace**, or opening the manual onboarding form merely because a verified PDF originated from n8n.

**Exception UX:** Show the precise missing/conflicting field or canonical booking reason. Offer manual review only when evidence, identity, coverage, approval, duplicate/ownership or transaction safeguards actually fail. Never automatically retry a failed or uncertain booking. An explicitly confirmed one-policy retry of a review hold always re-reads the current PDF and matches the document ID and fingerprint first.

## Parser output required for one-click eligibility

1. Stable unique `parser_id`, insurer identity, parser version, exact **trained** check count and no blocking warnings. All checks must pass. A green extraction is **not** booking approval.
2. An array of unique `fields` with nonempty, normalized values and source evidence. Required: insured name, insurer, policy number, separately verified policy issuance date, policy/TP validity, product/class, vehicle make/model, manufacturing year with approved provenance, fuel, engine/chassis, capacity in correct CC/kW/GVW units, registration status/number, and IDV. RTO city and state are separately optional source enrichment, never prerequisites for extraction or booking.
3. **Registered** vehicle: complete printed registration number and registration authority verified by plate/RTO or explicit document authority, never billing/insured address. **Unregistered** vehicle: a separately certified insurer-specific path; provisional city must be identified as provisional and must never impersonate a registered RTO.
4. Exact premium breakdown: printed OD, TP, net, GST and gross with reconciled cents. Include owner-driver CPA, add-ons, deductions, paid-driver liabilities and stamp duty only with an insurer-specific validated allocation. **Never silently zero or double-count CPA**. The standard commercial direct path is limited to a separately printed zero-CPA and clean OD+TP=net, net+GST=gross; positive/unclear CPA remains review-controlled until a dedicated mapper is tested.
5. Prove policy product maps to the canonical form (e.g., Package; GCV vs MISD). The UI must contain matching active insurer/manufacturer master data. Blank inferred data is not filled with fabricated defaults.

## Implementation checkpoints for each new insurer node

- Add a trained parser profile in `lib/ai-policy-onboarding-eligibility.ts` with the actual check count and warnings policy.
- Define or extend an insurer-specific booking evidence assessor (use IFFCO or standard-commercial assessor as a template). A parser must be **deny-by-default** for booking until certified test PDFs pass.
- Validate a matching premium/CPA mapper in `lib/policy-n8n-onboarding-premium.ts`; do not reuse another insurer's allocations without independently proving their structure.
- Ensure `prepareVerifiedN8nIntakeHandoff`, its queue `markFreshParseForReview` decision and `convertVerifiedAiIntakeCore` all call the **same** eligibility logic and preserve the PDF fingerprint, identity, date and canonical checks. Never put an insurer name allowlist in just one stage that defeats an already certified parser.
- Map registered/unregistered mode, class, model, RTO, source notes, manufacturing year, dates, OD/TP/CPA and premium periods consistently into the canonical draft. During one-click conversion, fill only verified blank fields; never overwrite a nonempty operator edit.
- Do not apply the same mandatory fields blindly to standalone OD, bundled, commercial or two-wheeler products. Certify required and prohibited fields by product variant. Signed-date/receipt agreement and OTP rules remain separate from extraction success.
- Add positive and **negative** regression fixtures from at least two layouts of that insurer, including unknown RTO, conflicting PDF/draft, duplicate policy, mismatched fingerprint, unclear/positive CPA, premium rounding, missing issuance date, OTP, identity/ownership conflict, repeat click and interrupted response.
- Verify UI offers **Convert** for a clean verified queue and explicit review-held retry without first demanding Reprocess/Reparse, and displays precise validation failure when a check cannot pass.
- Run the full Web Portal CI including regressions, lint, TypeScript and production build before merge. Deploy manually from `main` only after verification.

## JCB fuel inference (IFFCO and future insurer parsers)

Do not treat every JCB machine as Diesel: JCB produces electric equipment. For
IFFCO CV policies, populate a missing Fuel Type as Diesel only when the
PDF-printed make/model match a separately verified diesel manufacturer model
family (currently JCB 3DX Plus 2WD, VM117 NDD compactor, and 455-5N wheel
loader). Record this provenance in the extracted field evidence and retain the
PDF-printed model. An explicit conflicting fuel or an unrecognized/ambiguous
model must stop automatic booking until independently resolved. The parser's
18/18 extraction count is **not** sufficient to claim booking readiness.

## Current scope and limitations

- ICICI 3005 and Tata AIG use the previously established noncommercial premium route; Go Digit and IFFCO have insurer-specific commercial paths.
- New India Assurance, United India and Oriental have a strict **conditional** standard-commercial route for *fully evidenced registered, zero-CPA, reconciled Package* samples. Missing RTO city/state alone is **not an exception**. Incomplete net/OD/TP/tax or unsupported CPA evidence remain real exceptions.
- No n8n parser, workflow, policy master, policy record, database schema or background automatic booking is modified by this contract.
- For every future parser: extraction success and automatic bookability remain distinct states, while genuinely bookable documents have a one-step user-confirmed action.

## RTO optionality (approved 2026-11-24)
The extracted **RTO City** and **RTO State** are independent nullable fields for ALL insurers and product types. Read exact labelled policy source where available, derive state only from independently verified registered plate prefix or an authoritative RTO reference, and never fill missing city by guessing from insured/issuing address. Preserve one value when only one is available, preserve both when available, and leave both blank when neither exists. **Missing or unresolvable RTO geography must not create a parser exception, suppress verified handoff, or block canonical booking.** A conflicting *positively verified* city/state/registration source remains a separate genuine integrity issue. Registration status/full plate when registered, chassis/engine, date, premium/CPA/NCB, policy identity, duplicates and approvals remain subject to existing guards.
