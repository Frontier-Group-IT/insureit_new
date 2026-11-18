# ICICI 3005 / 3005-O — verified draft and parser variant recovery

**Scope:** ICICI Lombard policies only. **No Go Digit, United India, New India Assurance or unrelated Motor policy parsing or queue changes.** No bulk requeue, automatic booking or overwrite of completed policies.

## Why the two existing OD drafts were blocked

- `PIR-261117-925B83` and `PIR-261117-953F1B`: queue shows ICICI 3005/O, 13/13 checks, all 26 field keys including independently printed `policy_issuance_date`. Their saved draft has **issuanceDate 2026-11-18** (nonempty), but current independently verified PDF has another date. Old fill-empty-only behavior protected it (correctly) yet prevented booking. Both drafts also have blank policy number, coverage, TP reference expiry, insurer and OD/TP/CPA amounts; only correcting the date would reveal the next mismatch.
- The new authorized UI **Compare current PDF and saved draft** re-fetches the current private PDF through n8n and verifies document ID, fingerprint and 13 checks. **Confirm PDF-verified draft repair** is a separate explicit action that uses optimistic draft revision, expected saved date and rechecked current PDF. It may replace only the explicitly reviewed conflicting issue date; otherwise fill **only empty** source-mapped fields (policy number, validities, insurer ID, OD/TP/CPA/add-ons, etc.). Nonempty conflicting policy data remains unchanged and booking still requires canonical safeguards. No silent date substitution.

## Six existing 3005 Bundled exception Intakes

`PIR-261107-9A5976`, `PIR-261111-0C53DA`, `PIR-261116-C805CB`, `PIR-261117-689892`, `PIR-261117-D0A750`, `PIR-261117-63FB51` had older accepted queue responses with only ~19 fields, missing separately extracted `vehicle_class`, `vehicle_fuel_type`, `vehicle_motor_power_kw`, and `policy_issuance_date`. All are still **not eligible for unattended booking** until the local n8n parser emits independent PDF evidence. Populated manual drafts are retained; no generic default is proof of a policy's original issue date.

## Three attached PDFs — inspected schedule text and amounts

These policy schedules are *not* examples of unknown product codes. Their current live queue states are `unsupported`, `last_error_code=parser_not_trained`, `checks_passed=0`: the website never accepted a strict validated n8n response. The old generic code did not distinguish a missing/incorrect parser response from a genuinely unsupported insurer. This website PR stores/returns allowlisted **specific strict n8n validation codes on future retries**, but cannot reconstruct historical n8n execution failures or edit Windows-hosted n8n JavaScript.

| Intake | Product | PDF-issued date | OD / TP period | Premium verification | Variant to test locally |
| --- | --- | --- | --- | --- | --- |
| `PIR-261117-BE8ABA` | 3005/O `.../000` | 2026-11-10 | OD 2026-11-12–2027-11-11; TP reference 2025-11-12–2030-11-11 | Basic OD 2056 + Zero Dep 640 = OD 2696; GST 485; gross 3181 | Ordinary BAJAJ / CHETAK 3503, 4.2 kW, no NCB |
| `PIR-261117-800D9B` | 3005/O `.../B00` | 2026-11-10 | OD 2026-11-10–2027-11-09; TP reference 2024-09-10–2029-09-09 | Basic OD 1774 + Zero Dep 634 + Smart Assist 99 − NCB 444 = OD 2063; GST 371; gross 2434 | B00 suffix, CHETAK BLUE 2903, 2.8 kW, two addons, current 25% NCB |
| `PIR-261118-673F2A` | 3005 Bundled `.../000` | 2026-11-16 | OD 2026-11-16–2027-11-15; TP 2026-11-16–2031-11-15 | Basic OD 1598 + Zero Dep 683 + Return-to-Invoice 248 + Battery Protect 310 = OD 2839; TP 3273; CPA **0**; GST 1100; gross 7212 | Business insured, new registration, masked PDF mobile, Chetak 3503, 4.2 kW, 3 OD add-ons, no compulsory owner-driver CPA |

All policy dates above are taken from **Policy Issued On** and separate OD/TP schedules, not from PDF footer/signature date, premium receipt date, email date or the current system date. Seating capacity `2` is not electric motor power `4.2`/`2.8` kW. Masked policyholder phone must never be fabricated or inferred from other records.

## Local Windows n8n work still required

The existing local Docker n8n workflow ID is `0uGscm0WUegvxa6V`, at `http://localhost:5678`. This PR does **not** access the Windows host or modify/publish its workflow. After backing up its JSON, inspect the **ICICI Product 3005 Parser** and **Return INSUREIT Review-Only JSON** nodes. Individually run whole-workflow, authenticated Test webhook multipart PDFs with expected intake/document/request UUIDs, using a *locally authorized review-only* execution.

1. Keep strict first-line discrimination: `Product Code: 3005/O` versus `Product Code: 3005`; parse the full `3005/O/<7-12 digits>/<2 digits>/<3 uppercase alphanumerics>` including `B00`. Do not confuse TP reference policy number with the current OD policy number.
2. Parse schedule `Policy Issued On` despite text extraction splitting its label and value onto separate lines. Do not substitute the Risk Assumption Letter date, receipt date, footer date or signature timestamp.
3. Read the `CC/KW` column independently from `Seating Capacity`. Validate make CHETAK/BAJAJ, model, electric fuel (only with valid evidence), manufacturing year, chassis and engine identifiers. Keep `NEW` as an unregistered vehicle marker.
4. Parse **all listed OD add-on premium rows** and separately print subtotal, NCB deductions, total OD, TP, CPA, IGST and gross. Accept zero CPA explicitly stated for non-individual owner, without inventing CPA 575.
5. Return required response envelope `contract_version=1`, exact ID echoes, approved parser ID/version, 13 check keys true, `ok=true`, no warnings, `review_required=true`, `auto_finalize_allowed=false`. Ensure results are the **last node's JSON**, not raw Webhook input.
6. Test the three variants above, then the existing two known-good PDFs. If any fails, change and retest only the local parser Code node and its reviewed response node. The website contract's new regression tests **do not prove** the local parser ran.

## Controlled release gates

- CI and code review of website PR. **No production website deployment until manual release.**
- The date correction operation requires two explicit server-validated steps, does not register a policy or touch external insurer queues; verify with both blocked OD drafts.
- Rerun only the three attached ICICI Intakes after local n8n parser test passes, not `Reprocess All Previous`. Review resulting granular `n8n_*` error codes on failure.
- Reprocess six older Bundled Intakes only once their missing fields are actually emitted. Verify date + manufacturer + KW + premium; leave conflicting preexisting manual values for operator review.
- Compare Policy Register and duplicate status before any actual policy registration. Existing completed policies must never be rebooked. Preserve current user/date OTP/ownership checks.
