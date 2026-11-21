# INSUREIT policy parser contract — extraction to one-click booking

## Product behavior (applies to EVERY existing and future n8n insurer parser)

**Expected UX:** Upload a policy PDF → extraction → source-specific checks → queue **Verified** if all mandatory booking evidence is present → one explicit **Convert to Policy** confirmation → existing canonical booking transaction → policy code on success. Do **not** require **Reprocess PDF**, **Reparse & Replace**, or opening the manual onboarding form merely because a verified PDF originated from n8n.

**Exception UX:** Show the precise missing/conflicting field or canonical booking reason. Offer manual review only when evidence, identity, coverage, approval, duplicate/ownership or transaction safeguards actually fail. Never automatically retry a failed or uncertain booking. An explicitly confirmed one-policy retry of a review hold always re-reads the current PDF and matches the document ID and fingerprint first.

## Parser output required for one-click eligibility

1. Stable unique `parser_id`, insurer identity, parser version, exact **trained** check count and no blocking warnings. All checks must pass. A green extraction is **not** booking approval.
2. An array of unique `fields` with nonempty, normalized values and source evidence. Required: insured name, insurer, policy number, separately verified policy issuance date, policy/TP validity, product/class, vehicle make/model, manufacturing year with approved provenance, fuel, engine/chassis, capacity in correct CC/kW/GVW units, registration status/number, RTO state/authority (not mailing city), and IDV.
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

## Current scope and limitations

- ICICI 3005 and Tata AIG use the previously established noncommercial premium route; Go Digit and IFFCO have insurer-specific commercial paths.
- New India Assurance, United India and Oriental have a strict **conditional** standard-commercial route for *fully evidenced registered, zero-CPA, reconciled Package* samples. Missing RTO, incomplete net/OD/TP/tax or positive CPA are real exceptions: **do not claim they can be booked automatically yet**.
- No n8n parser, workflow, policy master, policy record, database schema or background automatic booking is modified by this contract.
- For every future parser: extraction success and automatic bookability remain distinct states, while genuinely bookable documents have a one-step user-confirmed action.
