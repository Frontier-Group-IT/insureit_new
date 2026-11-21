# Worked training case — New India commercial GCV / partial plate / named RTO

This is a **sanitized** summary of the user-supplied four-page NIA Commercial Vehicle Package Enhanced Covers policy and the matching November 2026 portal report. Never commit the original document, identifiers, contact data or VIN.

| Evidence | Source printed on policy | Interpretation |
|---|---|---|
| Policy type | Page 1: Commercial Vehicle Package Policy Enhanced Covers | Commercial motor package / GCV |
| Make/Model | Page 1: `TATA MOTOR/1918 AZURA` | Canonical **Tata** + model **1918 AZURA**; preserve original text |
| Registration | Page 1: `Registration no. MP-51` | **Incomplete prefix**, not a valid registered plate |
| Name of registration authority | Page 1: `Mandla - MP 51` | RTO **Mandla**, state **Madhya Pradesh**, exact PDF evidence; no inference from insured address |
| Vehicle | Page 1: diesel; 2026; GVW 18,500; cubic capacity `0cc` | Fuel Diesel, manufacturing year 2026, capacity **18,500 GVW** (NOT cc) |
| Date of issue | Page 3: `Date of Issue: 20/11/2026` | Separately printed issuance date; avoid coverage start substitution |
| Coverage | Page 1: `20/11/2026 03:39:55 PM to 19/11/2027 11:59:59 PM` | Start/end from actual period |
| OD/TP | Page 2: total OD ₹15,184; total TP ₹35,738 | Printed TP includes CPA ₹275 and paid-driver LL ₹150; do not double-count |
| Taxes | Page 2: printed IGST ₹2,810 at 18% plus ₹1,766 at 5% | Mixed GST; printed total ₹4,576, **not 18% of net** |
| Totals | Page 2: net ₹50,922; total payable ₹55,498 | ₹15,184 + ₹35,738 = ₹50,922; ₹50,922 + ₹4,576 = ₹55,498 |
| IDV | Page 1: ₹2,978,298 | Printed insured declared value |

Observed production state, **read-only**: `new_india_cv_native_pdf` parser 16/16; queue `exception_codes=["missing_field"]`, `last_error_code=nia_missing_registration_authority`; queue `field_keys` contains `vehicle_make` but **not** `vehicle_rto_name`; saved draft Make **Tata** and RTO city blank. The popup also displayed *Vehicle make not matched*. This is evidence of at least one distinct mismatch between exception presentation and current draft, not proof that the make was missing.

## Generalizable refinement objective

For **New India CV schedules that print a partial `MP-xx` reference AND a separate named registration authority**, extract `vehicle_rto_name` from the bounded `Name of registration authority:` field and normalize the printed state code, retaining partial/unregistered plate status and preserving clear source provenance. Do **not** synthesize a full registration. Revisit queue diagnostics and dropdown mapping separately; refresh stale booking reasons from current evidence only when appropriate. Add at least two layouts (one named authority and one genuinely missing authority) and enforce negative tests (insured address city, Gurgaon issuing office, generic MP prefix, ambiguous district). A synthetically populated draft alone is not proof of eligibility.

## Important open checks

- Confirm the live n8n `New India Assurance CV Parser` output and exact text extraction order before altering its regex; no change to that node is implied by this worked example.
- Confirm canonical product/registration statuses and mapping of printed CPA/driver LL into the form before allowing verified Convert.
- The portal contact/lead-source identity may differ from the PDF's masked insured phone: never substitute blindly or expose it.
- Do not auto-clear the error or book this example just because the PDF prints Mandla. All remaining canonical checks must pass.
