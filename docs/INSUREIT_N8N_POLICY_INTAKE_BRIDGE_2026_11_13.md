# INSUREIT Policy Intake ↔ n8n OCR Bridge (draft, 2026-11-13)

## Scope and current state
- n8n Cloud draft workflow: `Iu6WUQiHeGwfDol9` (`INSUREIT - n8n Policy Intake OCR Bridge (DRAFT)`).
- Existing learning workflow `2niTiMr514gUKhR6` remains untouched.
- The n8n draft now has a dedicated Header Auth credential assigned, and the synthetic PDF successfully passed a real authenticated multipart **Test URL** call on 2026-11-14. The workflow remains **unpublished**. No live intake or database calls have occurred.
- This PR adds only an unreferenced server-side adapter and response validator. No feature flag is enabled and there are **no production behavior changes**. This does not claim full automation.

## Existing website pipeline to preserve
Operations/Partner Policy Intake uses `policy-documents` Supabase Storage; `policy_intake_requests` and `policy_intake_documents` reference the current original/replacement document. Current `processStoredOcr` (Operations) and the Partner intake handler invoke the existing Google Document AI-backed extraction, populate `ocr_fields` / `ocr_warnings`, and route to `ready_for_review`. Existing duplicate blocking, customer matching by phone **and insured name**, role-gated review/finalization, revision-controlled drafts and final policy booking remain authoritative.

**n8n must never use Supabase service_role, create a customer/vehicle/policy directly, decide privileged reviewer assignment, or silently finalize an intake.**

## Request (future opt-in only)
Server-to-server HTTPS POST multipart/form-data to:
`https://insureit.app.n8n.cloud/webhook/insureit-policy-intake-icici-v1`

Header: `x-insureit-policy-intake-secret` (high entropy, 32+ characters; configured as matching n8n Header Auth credential). Do **not** send this from the browser.

Fields:
- `intake_id` UUID
- `document_id` UUID for current document
- `request_id` unique UUID/idempotency key
- binary field `data` containing a single PDF (maximum 15 MiB)

Never supply arbitrary user-defined URLs; origin and path are allowlisted in the adapter.

## Response
```json
{
  "contract_version": "1",
  "intake_id": "00000000-0000-4000-8000-000000000001",
  "document_id": "00000000-0000-4000-8000-000000000002",
  "request_id": "00000000-0000-4000-8000-000000000003",
  "ok": true,
  "parser_id": "icici_3005_n8n_native_pdf",
  "parser_version": "bridge-v1",
  "extraction_method": "native_pdf_text",
  "review_required": true,
  "auto_finalize_allowed": false,
  "checks": { "is_icici_3005": true },
  "fields": [
    { "key": "insured_name", "label": "Name of Insured", "value": "SAMPLE INSURED",
      "confidence": null, "page": 1, "evidence": "Name of Insured" }
  ],
  "warnings": []
}
```

Successful response must contain all required field evidence and every check true. The website validator rejects unknown field keys, duplicate keys, mismatched UUIDs, unexpected parser/version, malformed field values, and failed validation. It also refuses any response that asks for unattended finalization.

Use the existing `ParsedPolicyField` shape when writing authorized `ocr_fields` in a **later separately approved integration**. The n8n OCR output is a *proposal*; existing INSUREIT business rules remain the source of truth. Note: native extraction currently supports ICICI Product 3005 *digitally readable PDF layouts* only. Do not use it for scanned/unseen layouts without a reviewed OCR fallback.

## Before any release or integration
1. Assign a dedicated restricted Header Auth credential in n8n. Rotate credentials safely; never commit secrets.
2. Test the n8n Test URL with **synthetic PDF** and all negative conditions (missing/wrong signature, wrong MIME, stale IDs, duplicate and inconsistent premiums).
3. Benchmark real, consented policies against reviewer-approved truth, including Basic OD, add-ons, TP, CPA, IDV, dates and insured identity; scrub stored execution data and apply retention limits.
4. Add an opt-in website routing layer that sends the **current** document ID, validates document/storage path/version before and after the call, and only writes `ocr_fields` after authorization and lifecycle checks. Preserve fallback to Google Document AI and manual review.
5. Build branch-only regression/CI covering retries, stale documents, race conditions, redacted logs, identical policy-number duplicates, customer-name/mobile conflicts and non-3005 rejection.
6. For eventual automation: separate verified field extraction from privileged customer/vehicle/policy commits; use idempotent server-side transactions and explicit business authorization/approval policy. Never infer a match from mobile alone, never auto-book without an approved role/feature rollout.
7. Obtain explicit approval for merge, deployment, n8n publication, production credentials, and any production write or auto-onboarding. No production environment is available for destructive test execution.

## Progress: guarded integration (2026-11-13)
- Both Operations and Partner Policy Intake now call the same opt-in router on the PR branch. It is **off** without explicit environment configuration, with an intake-ID allowlist; unchanged default Google path.
- The router reads current document identity before n8n call, filters for digitally readable ICICI Product 3005 PDFs, and checks identity again after n8n response. Shadow mode compares fields but still returns Google. Prefer mode uses validated n8n extraction, otherwise Google fallback.
- New n8n response contains a numeric premium breakdown. Website independently reconciles Basic OD + add-ons, TP + CPA, OD + liability, net + rounded tax, exact IGST round-off and proposed OD/TP/CPA fields. Failing or malformed responses fall back to Google.
- Configure only after credential and synthetic/negative tests. Env: `INSUREIT_N8N_OCR_MODE=off|shadow|prefer`, `INSUREIT_N8N_OCR_ALLOWED_INTAKE_IDS=<approved UUIDs>`, `INSUREIT_N8N_OCR_WEBHOOK_URL`, `INSUREIT_N8N_OCR_HEADER_SECRET`. Do not enable on production yet.
- No auto-finalize, customer or vehicle creation, or policy booking; existing authorized review still required.

## Current validation and publication state
- **2026-11-13:** New n8n draft now contains a separate manual synthetic fixture, routed through the real ICICI parser and response formatter. A synthetic example completed successfully in n8n execution 8: 17 proposed fields, all 13 checks true; Basic OD ₹1,758 + TP ₹3,273 + CPA ₹575 + rounded tax ₹1,009 = gross ₹6,615. Data-retention settings restored to none after inspection.
- The workflow is **not published**. The Header Auth credential is assigned. The real multipart webhook test on 2026-11-14 returned HTTP 200 with `ok:true`, 17 extracted proposal fields, 13/13 checks, zero warnings and ₹6,615 gross premium from the independent fictional PDF fixture. This proves the authenticated PDF endpoint and extraction pipeline run together; it does **not** establish accuracy for real insurer-issued PDFs. No website-to-n8n production call or write has been performed.
- Browser/production integration cannot be tested without separately configured secure n8n credential and explicitly approved test intake. Keep `INSUREIT_N8N_OCR_MODE` unset/off and allowlist empty until approval.
- The PR's router handles both Operations and Partner upload/replacement flows, with per-intake opt-in, document identity checks, native-PDF ICICI 3005 gating, shadow/prefer modes, and Google fallback. The existing finalization permissions and draft-revision controls stay intact; **full automated onboarding is not yet implemented**.

## 2026-11-14 validation hardening and next test gate

- Added strict server-side enforcement of **all 13 named** parser checks; missing, renamed, extra or false checks fail closed instead of relying on a minimum check count.
- Reject invalid, non-ISO or reversed Own Damage policy dates before accepting an n8n proposal.
- Added branch-only regression cases for missing/substituted checks, impossible calendar dates, non-ISO dates and reversed coverage ranges. GitHub Actions checks must pass before review/merge.
- The current response includes Own Damage start/end dates but does **not** propose the distinct Third Party start/end date pair, mobile number or address. These must be explicitly compared to real sample PDFs and handled separately; do not infer a TP coverage period from OD or invent customer details.
- Real-PDF benchmark (not yet executed): use a consented/redacted ICICI Lombard Product 3005 native PDF, verify printed insurer/policy number, exact `Name of Insured`, OD and TP coverage periods separately, vehicle identifiers, make/model/year, registration, RTO, IDV, Basic OD + all add-ons, TP, CPA, net, GST and gross. Treat missing phone/address and inconsistent fields as reviewer-action items, not inferred truths.
- Do not send unredacted customer data into issues, screenshots, CI artifacts or execution logs. Keep production integrations off; no merge, deployment, publication or auto-finalization without explicit approval.

## 2026-11-14 sanitized real-layout offline benchmark

- An ICICI Lombard Product 3005 three-page PDF previously supplied by the user was inspected read-only. Its extracted text was identity-sanitized before feeding the parser offline. The original customer PDF was **not uploaded to n8n** or CI and no live Policy Intake record was accessed.
- The previous n8n parser yielded **11/13** checks against the realistic two-column premium schedule. Exact causes: Basic OD/add-on label and amount were laid out in side-by-side rows, and the IGST percentage appeared before the `IGST` label.
- Updated n8n draft workflow `Iu6WUQiHeGwfDol9` to parse recognized inline OD components and subtotal, and the `% ... IGST ... amount` ordering. Offline sanitized-layout replay now returns **13/13** with Basic OD ₹1,583, Zero Depreciation ₹683, total OD ₹2,266, Basic TP ₹3,273, CPA ₹575, net ₹6,114, exact IGST ₹1,100.52, rounded tax ₹1,101 and gross ₹7,215.
- Re-ran original synthetic vertical-text fixture offline against updated parser: **13/13**, gross ₹6,615. Neither result proves byte-for-byte n8n PDF extraction of the original real PDF; this remains a separate review gate.
- **Coverage gap:** TP coverage start/end are extracted internally but not emitted as proposed fields to the website. Mobile/address information is masked or not included in the current proposal. Never infer an actual mobile number from a masked PDF, and never substitute OD expiry for TP expiry.
- **Current release gate:** Site adapter remains off and PR remains draft; the n8n workflow remains unpublished. Require green GitHub CI, sanitized or consented real-byte PDF test, authorized field-by-field review, negative tests, and explicit deployment approval before any shadow rollout.

## 2026-11-14 distinct third-party coverage validation

- n8n DRAFT parser and response serializer now expose `third_party_start_date` and `third_party_end_date` as separate evidence-backed proposed fields, alongside the existing Own Damage `policy_start_date` / `policy_end_date`. The synthetic bundled fixture independently returned TP expiry 2031-11-05 versus OD expiry 2027-11-05.
- Website draft PR validator now requires both TP fields, validates strict ISO calendar dates and chronological ranges, and fails closed when TP start disagrees with the bundled policy's OD start or TP ends before OD. Other products or non-aligned coverage must use the existing Google/manual path pending specific insurer layout review.
- Regression tests cover omitted TP expiry, impossible TP date, mismatched TP start, and prematurely expiring TP. No proof of full real PDF binary-to-n8n processing from the earlier offline text fixture; reviewer comparison and authenticated multipart byte test remain release gates.
- No n8n publication, PR merge, website deploy, environment activation, production data modification, policy creation or auto-finalization occurred.

## 2026-11-14 two-column synthetic PDF authenticated end-to-end result

- Operator ran a real authenticated multipart `POST /webhook-test/insureit-policy-intake-icici-v1` with the new fully fictional two-column ICICI 3005 PDF fixture. Captured response returned `ok:true`, **19 fields**, **13/13 checks true**, `warnings:[]`, `review_required:true`, `auto_finalize_allowed:false`.
- Policy financials exactly reconcile: Basic OD ₹1,583 + Zero Depreciation ₹683 = OD ₹2,266; Third Party ₹3,273 + CPA ₹575 = liability ₹3,848; net ₹6,114; IGST exact ₹1,100.52, rounded tax ₹1,101; **gross ₹7,215**. Vehicle IDV was ₹1,24,113 in this fixture.
- OD was extracted as 2026-10-28 through 2027-10-27, while TP was independently extracted as 2026-10-28 through 2031-10-27. Response parser version `bridge-v1`, method `native_pdf_text`, secret never recorded in response.
- This is the **second synthetic document's authenticated binary-to-JSON test**, not a real customer policy validation. The previously uploaded real policy was examined offline only. No real customer PDF was transmitted to n8n by this test.
- Latest PR head before documenting this test `056d4aa0bf2fc364c871f884976ee19fdcb6323f` had successful **Verify web portal** and **INSUREIT dependency assurance evidence** checks. Documentation-only commit requires its own checks before treating the new head as green.
- Remaining release gates: verify negative auth and malformed file handling; review separately authorized real-PDF evidence and masked contact gaps; select real authorized intake IDs; establish shadow-only config and confirm Google remains authoritative; do not deploy/merge/publish/auto-finalize without specific subsequent approval.

## 2026-11-14 negative authentication test — completed

- The operator called the n8n **Test URL** `POST /webhook-test/insureit-policy-intake-icici-v1` without `x-insureit-policy-intake-secret`. The webhook returned **HTTP 403 Forbidden** and `Authorization data is wrong!` at **2026-11-14 10:14:02 UTC**, denying the request before PDF extraction. This is a successful **missing-secret rejection** test; the test correctly returned 403 rather than the previously anticipated 401.
- The two authenticated synthetic PDF tests independently succeeded; neither response authorized auto-finalization. The authenticated **wrong-secret**, **invalid PDF/mismatched MIME**, and user-authorized real-PDF tests remain pending. The user did not disclose the credential.
- This does not authorize publication, production website integration, production intake writes, or policy booking. Maintain draft/off/shadow-only release gate.
