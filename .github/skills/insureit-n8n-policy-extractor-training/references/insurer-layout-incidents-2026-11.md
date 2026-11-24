# November 2026 INSUREIT n8n policy extraction: incident library and reusable fixes

Read with SKILL.md, diagnostic-playbook.md and acceptance-gates.md. This is a sanitized engineering summary of demonstrated problems, not a guarantee that any held policy is booked. No actual policy numbers, VINs, customer names, mobile numbers, URLs with signatures or PDF binaries are to be committed.

## Source-of-truth chain and triage

Inspect original CURRENT policy PDF (pages/tables and whether text extraction reorders labels) -> signed-file/document fingerprint -> n8n active published workflow and matching execution ID -> exact insurer/product classifier -> Code node checks/field values/premium components -> strict website response allowlist -> queue state and exception codes -> onboarding draft and master dropdown -> conversion preflight -> atomic booking. Diagnose the FIRST point where source-correct value differs; do not treat generic n8n_review_required as root cause, or a parser 20/20 as end-to-end success.

## Mandatory issuance date priority

1. Printed, explicit Policy Issue Date / Issuance Date from PDF is PRIMARY and final when valid. Native PDF text may list the value above/before the label: inspect the rendered page and constrain regex to that exact policy schedule row. Do not substitute premium receipt, PDF CreationDate/ModDate, policy start, download/upload time or signature date when printed date exists.
2. Fallback ONLY when no reliable printed issue date: independently read the date on the signature image using a real render/OCR/verification stage, tied to current PDF and page. If no such stage/evidence exists, hold for review. A PDF signature-present flag is not a signature-image read. Never advertise cryptographic verification if only metadata or visible stamped text was read.
3. Record source provenance and separate date-approval OTP from parser validation. A different receipt/creation date does not automatically invalidate an otherwise clear printed issuance date. Ambiguous/conflicting printed values remain review-required.

## Actual blockers and generalizable corrections

| Incident / layout | Root issue found | Durable rule / guard |
|---|---|---|
| SBI General Private Car Package, Tata Punch | 19/20 checks; parser demanded a visible signature timestamp from PDF text even though issue date was printed. PDF metadata was later incorrectly made a mandatory comparison. | Extract printed issue date as authoritative; use image-based signature fallback ONLY if no printed date, rather than requiring receipt, signing or CreationDate agreement. Retain independent premium and identity checks. |
| SBI General Private Car Package, Mahindra XUV300 | Same insurer/product, but six OD add-ons, 45% NCB and cross-page GST; original variant was hard-coded to Tata/0% NCB/four covers. | Detect actual insurer AND product, then validated supported layout family. Basic OD minus NCB + each named add-on = printed total OD; TP basic + CPA separate; net + GST = rounded payable. Accept valid cross-page tables and matching make/model/CC, reject NCB/tax tampering. Do NOT invent a new insurance product from a premium change. |
| SBI canonical conversion | Total OD was at risk of being mapped as basic OD or NCB/add-ons counted twice. | Form basic OD = verified basic OD after NCB, add-ons in add-on slot, TP basic in TP, CPA separately; reconcile total before booking. |
| HDFC ERGO two-wheeler liability only | Parser output and saved TWP draft were correct, but conversion expected generic MISD. | Product-specific preflight maps this insurer's Two Wheeler to TWP and TP-only. Fix downstream mapping rather than retrain a correct parser. |
| SBI Package canonical product | Parser returned Package/Private Car but older conversion mapping defaulted to MISD or Third Party. | SBI Package maps to PCP / Package; preserve original PDF product. |
| Zurich Kotak private-car TP Tata Nano | Working Hyundai/Maruti path rejected Tata model and alphanumeric engine layout. | Extend named model/engine family narrowly, preserve older families and rerun all negative tests; TP-only must not gain OD/CPA. |
| Go Digit Two-Wheeler standalone OD | Earlier in-force TP was a reference, not newly sold TP; form could conflate them. | Map newly charged OD only; new TP/CPA zero, preserve old TP end-date as a reference. |
| United India Tractor TP | Distinct agricultural tractor class and liability-only premiums, with CPA waiver and official RTO. | Route by insurer + printed product, use tractor class MISD only where appropriate, avoid generic GCV/PCP fallback. |
| New India partial registration MP-51 | Partial authority code was interpreted as registered plate or conflated with blank RTO city; unrelated 'make not matched' popup obscured cause. | Partial plate is not a complete registration; extract independently named Registration Authority Mandla; do not infer from address or office. |
| ICICI 3005 / 3005-O | Product-code/OD variants were mixed, add-ons or 5%/18% tax portions lost; n8n Cloud/local mismatch and legacy fallback hid reasons. | Identify precise 3005 layout; reconcile OD + add-ons - NCB, separately TP/CPA, mixed tax by original rows; native text reading order; verified local webhook schema. |
| Generic n8n_review_required | Old stored exception code does not identify an actual failed check. | Retrieve matching local execution ID and full named check set; show current failures and allow explicit current-PDF reparse. No automatic backfill or success by stale code. |
| Reparse and queue | Parser repaired, but old queue draft still had 0 checks; two same-looking Reprocess/Reparse actions confused users. | New published parser does NOT automatically mutate old rows. Bound safe reparse to current signed PDF and fingerprint; replace draft only on full validation. Do not mark verified or book from a stale exception. |
| Policy already booked | PDF can still be uploaded/re-extracted after final policy exists. | Verify final_policy_id/duplicates before retries; never create another policy or skip idempotency check. |
| n8n webhook response | Early workflow returned only the trigger envelope instead of validated parser JSON. | Respond after last parser/return node; enforce contract fields, parser identity, exact checks, source IDs and review-only flags. Test actual response, not just HTTP 200. |
| Tunnel and hosting | Local Windows Docker n8n and external webhook traffic were initially confused with old n8n Cloud; quick tunnel URLs rotate. | Confirm live active/published workflow ID, secure stable hostname, signed private PDF source, auth and no SSRF; never change website DNS or replace working endpoints casually. |
| Release and CI | Branch conflict after another parser PR merged; old test assumed exactly three variants; cross-context vm array assertion and fixture errors masked real state. | Rebase onto newest main, retain previous regression suites, test distinct insurer variants, CI TypeScript/lint/build, inspect exact node diff, publish ONLY reviewed draft, separately verify website deployment and intake state. |

## Practical limits and acceptance

- A parser is a source reader, NOT booking authorization. Check source fingerprint, insurer, signature-image provenance when needed, master dropdown, insured identity, date OTP, duplicate policy, financial totals, customer/vehicle link and atomic transaction independently.
- Never weaken strict check sets to get green status, fabricate RTO/vehicle facts, or claim an OCR/image fallback happened when n8n's Read Policy PDF Text node never rendered a signature image.
- RTO authority does not need discretionary staff approval when explicitly correctly mapped, but still must be from actual document evidence rather than guessed location.
- Approved layouts can be handled automatically in the correct insurer/product branch for future files; unknown products or untrained layouts fail closed with a specific status and a new regression after review.
- Require positive and negative cases per layout: date source precedence, NCB and add-on arithmetic, cross-page totals, TP/CPA classification, saved-draft normalization and conversion readiness.
- PR merged, n8n published, Vercel deployed, current PDF successfully reparsed, and policy booked are FIVE different claims; report each separately.
