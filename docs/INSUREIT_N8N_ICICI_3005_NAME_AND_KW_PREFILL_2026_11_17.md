# ICICI Product 3005: verified insured name and CC/KW onboarding prefill

## Reported issue
The user provided an ICICI Lombard Product 3005 bundled Chetak C2501 native policy PDF and showed the canonical Policy Onboarding form with missing **Insured Name** and **Capacity (kW)**. Direct, locally inspected PDF layout evidence:
- Page 1 "Insured & Vehicle Details" has the insured name; the n8n validated extraction already returns `insured_name` with page-1 `Name of Insured` evidence.
- Page 2 "Certificate of Insurance cum Policy Schedule" has vehicle table columns `Make | Model | Type of Body | CC/KW | Mfg Yr | Seating Capacity`, in that order. The printed motor power is **2.2 kW**, while the adjacent **2** is seating capacity, not kW.
- Do **not** commit the source PDF, its real name, contact, policy number, chassis number, engine number, raw PDF text, or a production n8n payload in source code or test fixtures.

## Exact fixes
1. **Name:** The verified n8n ICICI Product 3005 current-PDF `insured_name` is allowed as an **editable and review-required draft-only prefill**, with bounded format and exact page-1 `Name of Insured` evidence. This user-requested, narrowly scoped exception is reflected in `AGENTS.md`. It does not extend generic OCR or other policy layouts. If an approved linked customer master matches, keep its canonical name and customer ID. If the PDF name disagrees with the master name, show the PDF name for review but remove automatic customer selection. If no linked master exists, show only the PDF-sourced name with no customer selection.
2. **No silent customer linking:** The handoff server and the canonical page reload never infer a `matchedCustomerId` using the PDF-derived name or unverified phone. Only the existing `matched_customer_id` plus exact Intake-phone and name match can preselect a customer. Creating or booking a policy remains a separate explicit action and is not triggered during n8n extraction/handoff.
3. **Power:** Update the **draft** n8n parser for the page-2 table. Match the same-line Chetak model, optional bounded Type-of-Body words, printed CC/KW numeric cell, manufacturing year, and next seating cell. The numeric value before the exact year is motor kW; seating is excluded. Reject unsupported or ambiguous layouts (leave capacity for manual input).
4. The canonical n8n handoff maps only the validated `vehicle_motor_power_kw` to **Capacity (kW)** when the known Chetak Electric/TWP class is selected. A saved draft is filled **only if the operator explicitly checks "Fill missing fields"**, only for blank fields, preserving manual values with optimistic revision check.

## Validation performed
- Native page-2 PDF layout tested locally: the exact model/year/table-row pattern returns **2.2** kW and **2** seating.
- n8n synthetic C2501 sample with `Solo With Pillion` between model and kW, synthetic `Name of Insured`, and 2.2 kW: workflow execution **22** completed successfully while asserting the exact proposal fields. The test assertion was removed and the synthetic trigger disabled again.
- Changed code is isolated in the website branch; **published n8n version remains unchanged** pending separately approved publication. No live customer or policy records were written.
- Run `Verify web portal` regressions, typecheck, lint, production build, and review the PR before merge; then separately approve production release and n8n publish. Re-extract a consented sample and compare both fields against its original PDF before booking. No real-policy booking during QA.

## Boundaries
- No automatic final policy booking or bypass of duplicate, signed-document, ownership, reviewer, or permission checks.
- No blanket insurer/model inference of kW, and no use of vehicle seating as motor power.
- No customer matching based on OCR name alone, and no PII added to logs, source fixtures, or analytics.

Rollback: revert the website PR or deployment and restore the previous n8n published version if a validated production rerun regresses. No database migration is required.
