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

## 2026-11-14: Integration into existing Development → AI Policy Onboarding pilot (PR #4397)

- The existing **/development/ai-policy-onboarding** Motor workbench, created under PRs #4321 and #4322, is the canonical entry point. The n8n interface is a **new Preview n8n PDF** action in its existing **AI Booking Check** panel, not a second onboarding or booking page.
- The preview uses the signed-in admin's existing `manage_system:approve` plus IT Super User / Super Admin restrictions, and each selected Intake's reviewer and finalizer permissions. It reads **only** the current private `policy-documents` PDF after matching `policy_intake_requests` with the current `policy_intake_documents` reference. Only digitally readable ICICI Lombard Product 3005 Motor PDFs <=15 MiB qualify.
- **Off by default.** Preview is available only when `INSUREIT_N8N_OCR_MODE=shadow|prefer` AND `INSUREIT_N8N_OCR_ALLOWED_INTAKE_IDS` contains the exact Intake UUID. All n8n calls go server-to-server through the fixed production URL and Header Auth secret; neither the secret nor raw PDF is passed to the browser.
- Preview returns a strict-validated 19-field evidence-backed proposal, count of changed fields and any warnings in the existing sidebar. No Intake, draft, customer, vehicle or policy mutation occurs when choosing an Intake or previewing n8n. Values have `confidence:null` and need original PDF review.
- A **separate explicit Apply reviewed fields to failed OCR** operation is compiled but disabled by default. It requires **both** `INSUREIT_N8N_OCR_MODE=prefer` and `INSUREIT_N8N_OCR_ALLOW_REVIEW_APPLY=true`, the exact per-Intake allowlist, a second browser confirmation, the same server permissions, successful remote extraction and matching SHA-256 reviewed-proposal fingerprint after re-extraction. It operates only on `status=processing`, `ocr_status=failed`, **empty existing OCR** and **no saved onboarding draft**.
- Apply validates the unchanged current document and status before writing, checks the canonical duplicate helper against the **newly extracted policy number**, and performs a status/source-scoped compare-and-set update to **Ready for Review + completed OCR**. It **does not** set a matched customer, assign/take over reviewer, create a new draft, create a customer/vehicle/policy or book a policy. On conflicts, it fails closed and retains manual correction.
- The existing canonical **Open & correct fields**, reviewer takeover confirmation, saved draft and **Confirm & book** transaction remain unchanged. The AI pilot's bundled/add-on coverage and other field/date/commercial-readiness blockers still apply. An n8n `ok:true` is **not** permission to book a bundled policy automatically.
- The server-side upload-time n8n router from the same PR remains independently off by default with Google fallback; this workbench path reuses its shared request/validation adapter and does **not** replace Google Document AI.
- **Release gates:** verify PR CI and branch code review, publish n8n only after separate deployment authorization, securely configure the exact production URL/secret in the Vercel Production runtime, start with a single authorized Intake in **shadow preview only**, verify real-document privacy, OCR fields, duplicate and reviewer safeguards, then separately approve any prefer/apply rollout. Do not enable broad allowlists. No production database, environment variables or live website were changed while implementing this PR.

## 2026-11-16 — Permanent n8n private-PDF source and strict OCR route

### Root cause and resolution
- The lack of a manual PDF download was **not a database access failure**: the original n8n webhook accepted browser uploads, but n8n itself had no authority to fetch private `policy-documents` objects. The Supabase MCP connector exposes database metadata, not raw private Storage file downloads.
- The production website's server-side Supabase admin client can verify the exact current Intake and `policy_intake_documents` entry, then call `storage.from("policy-documents").createSignedUrl(storagePath,120)` for one private object. This requires **no permanent Supabase service key in n8n** and does not expose the signed link to the browser.
- The website sends the signed link with the current Intake UUID, document UUID and a fresh request UUID to the existing **Header Auth** n8n Webhook using server-to-server JSON. The n8n `Validate Policy Intake Request` node restricts the URL to `https://ilzhsfqqjyppzzvfscmh.supabase.co/storage/v1/object/sign/policy-documents/intakes/<same-intake-id>/...` and requires the signed token. The `Download Current Private PDF` HTTP Request node downloads the URL as `binary.data`; the existing native PDF reader, ICICI 3005 parser and review-only serializer are reused. Redirect-following is disabled. The prior authenticated multipart path remains for regression tests.
- All signed URL values are short-lived bearer capabilities. No raw source URL, token, PDF text or service credential may be logged, included in CI, or displayed in the portal; n8n execution payload persistence remains off. A link cannot be revoked independently before expiration; on compromise, revoke through the project's Storage signing-key controls.

### Existing AI Policy Onboarding workbench
- `Preview n8n PDF` on `/development/ai-policy-onboarding` now invokes n8n's direct signed-link download **without downloading PDF bytes into the portal server**. The selected Intake still requires exact allowlist membership and the existing role, reviewer and finalizer authorization.
- At first inspection the user-selected live Intake `79bd38c4-0a52-470d-a755-b51e027eec91` was In Review with zero OCR fields and an existing draft. **A subsequent independent read-only recheck on 2026-11-16 showed status Completed and a linked final policy (OCR still failed)**; it is no longer eligible for either preview or recovery under the lifecycle guards. The integration work did not modify this record. Select and explicitly authorize a *new open Intake* for release verification. Its current PDF's path and size were verified read-only, but no live PDF bytes were retrieved or transmitted during this branch implementation.
- User approved read-only n8n processing for this specific Intake; this does **not** approve policy booking or bulk customer data processing.

### n8n as the primary OCR processor
- New explicit `INSUREIT_N8N_OCR_MODE=required` routes **only UUIDs listed** in `INSUREIT_N8N_OCR_ALLOWED_INTAKE_IDS` through the n8n-only signed-URL pipeline for both Operations and Partner new Motor Policy Intakes. The website neither downloads the PDF locally nor invokes Google Document AI in that branch. An invalid/unsupported n8n result becomes **OCR failed / manual review**, never a successful booking or silent Google fallback.
- Other Intakes still follow their existing OCR path until insurer/product coverage is migrated and verified. `off`, `shadow`, and `prefer` retain their prior behavior. `required` has **no default all-Intake wildcard** to prevent accidental live failure across unsupported insurers.
- After n8n supplies verified extraction modules for remaining insurers, scanned PDFs/images, Life/Health/Non Motor product proposals and full premium schemas, gradually migrate authorized cohorts. Complete removal of Google OCR requires a separate measured cutover: do not delete the Google implementation or change all production traffic while only ICICI 3005 native PDFs pass the strict contract.
- No n8n policy extraction creates customers, vehicles, policies, payment terms or drafts; canonical authorized review, duplicate/ownership/date/OTP checks and explicit Motor booking remain unchanged.

### Release gate / status
- Code and n8n draft graph updated; **not merged, deployed, published, enabled or tested with a live signed link**. This block intentionally differs from the earlier synthetic multipart tests.
- Gate: CI green on the latest commit; negative invalid host/path and expired signed URL checks; test signed link privately on approved Intake; compare insurer/product, identity, OD and TP dates, vehicle, premium and add-ons with source PDF; then authorise rollout.
- Environment to securely configure in the active portal runtime after release: `INSUREIT_N8N_OCR_WEBHOOK_URL=https://insureit.app.n8n.cloud/webhook/insureit-policy-intake-icici-v1`, `INSUREIT_N8N_OCR_HEADER_SECRET` (must equal n8n Header Auth credential), `INSUREIT_N8N_OCR_MODE=shadow` for first preview, `INSUREIT_N8N_OCR_ALLOWED_INTAKE_IDS=<separately-approved-open-intake-UUID>`, `INSUREIT_N8N_OCR_ALLOW_REVIEW_APPLY=false`. Change only the specifically approved Intake to `required` after a successful preview and full validation.

### Future explicit all-Motor cutover flag (disabled)

The `required` mode normally applies only to exact UUIDs in `INSUREIT_N8N_OCR_ALLOWED_INTAKE_IDS`. After real tests confirm **every required Motor insurer, product, scanned/native PDF/image and premium layout**, a separate release can set `INSUREIT_N8N_OCR_ALL_MOTOR=true` together with `INSUREIT_N8N_OCR_MODE=required`. Operations and Partner code guard on `policy_type === "motor"` so Life/Health/Non Motor do not enter this Motor-only transition. This flag is **not enabled** or ready for all insurers today.

The clean decommissioning criterion for Google is: adequate n8n layout/insurer coverage, invoice/tax/OD/TP/CPA benchmark parity, zero unauthorized downloads, verified manual exception handling, green PR workflows, monitored pilot, and a separately approved complete switch-over. Do not remove the legacy extractor until those conditions are met.

### 2026-11-16 pilot Intake lifecycle recheck
The previously approved example Intake became **Completed** with `final_policy_id` present by the last read-only query (record updated at 2026-11-16 04:56:52 UTC). It was **not** processed by n8n or modified through this implementation. Do not send it for a new pilot or replay an already-booked policy. The current signed-source helper excludes Completed Intakes, and required OCR processing checks status=processing. Choose a newly authorized pending Intake after deployment.

## 2026-11-16 — ICICI 3005 n8n rollout on Production Vercel

**Verified target (Vercel connector):** Team `antnish1s-projects`, project `insureit_new` (ID `prj_OLXA2UB1LwMd0UidP8MNa1O9MLuq`), GitHub source `Frontier-Group-IT/insureit_new`, domain `portal.insureit.in`, framework Next.js. User explicitly corrected the release environment: **test against the Production Vercel project, not Cloudflare**. The release stays manual.

### Configuration verified in Vercel Production

The following 5 encrypted Production variables were added through the connected Vercel account on 2026-11-16. They are safe for a disabled-first deploy; their values will be available to new production deployments, not retroactively to an already-running build.

| Variable | Verified value |
|---|---|
| `INSUREIT_N8N_OCR_WEBHOOK_URL` | `https://insureit.app.n8n.cloud/webhook/insureit-policy-intake-icici-v1` |
| `INSUREIT_N8N_OCR_MODE` | `off` |
| `INSUREIT_N8N_OCR_AUTO_ICICI_3005` | `false` |
| `INSUREIT_N8N_OCR_ALL_MOTOR` | `false` |
| `INSUREIT_N8N_OCR_ALLOW_REVIEW_APPLY` | `false` |

**Only remaining required credential:** `INSUREIT_N8N_OCR_HEADER_SECRET` is **NOT configured** in Vercel. The account owner must add it at Vercel → `antnish1s-projects` → `insureit_new` → Settings → Environment Variables, target **Production**, ideally type **Sensitive**; use the exact current n8n Webhook Header Auth credential value (minimum 32 characters). Never paste the secret into this repository, chat, screenshots, CI or `NEXT_PUBLIC_*`.

`INSUREIT_N8N_OCR_ALLOWED_INTAKE_IDS` is intentionally unset until the user selects and authorizes a **new open** policy Intake UUID. The previous selected example is now Completed and linked to a finalized policy; it is ineligible and must not be reprocessed.

### Safe manual Production Vercel deployment sequence

1. Ensure GitHub PR #4397 is green and reviewed. **User will manually merge and deploy**; do not auto-deploy as part of this PR preparation. Confirm the production Vercel project, Git commit SHA, branch and build status before live traffic changes.
2. Privately configure `INSUREIT_N8N_OCR_HEADER_SECRET` in **Vercel Production**, not Cloudflare. Keep `MODE=off`, `AUTO_ICICI_3005=false`, `ALL_MOTOR=false` and `ALLOW_REVIEW_APPLY=false` for the first code deploy.
3. Manually deploy the reviewed merge commit to Vercel **Production**. The main source is `apps/web-portal`. Validate `portal.insureit.in` is serving that exact deployment. Current n8n Webhook is already published and protected by Header Auth.
4. For the first real-PDF evidence run, explicitly authorize one open current ICICI Lombard Product 3005 Motor Intake. Set `INSUREIT_N8N_OCR_ALLOWED_INTAKE_IDS` to that UUID and `MODE=shadow` in Vercel **Production**; redeploy manually so the change is effective. Open **Development → AI Policy Onboarding**, choose the Intake, and click **Preview n8n PDF**. The site generates a scoped 120-second Supabase Storage signed URL and n8n's `Download Current Private PDF` node retrieves the original PDF directly; operators never download/upload it again.
5. Compare n8n against the original policy: insured name from `Name of Insured`, policy number, insurer/product, OD dates, separate TP dates, registration/engine/chassis, make/model/year, IDV, Basic OD and add-ons, TP/CPA, IGST and gross. Check unchanged draft, account scope and no accidental policy booking. Missing/incorrect fields require reviewer attention. Verify missing/wrong auth, invalid signed URLs, unsupported PDFs and expiry rejection separately, without exposing customer details or signed URLs.
6. After successful authorized real-PDF comparison, update Vercel Production variables to `MODE=required`, `AUTO_ICICI_3005=true`, `ALL_MOTOR=false`, `ALLOW_REVIEW_APPLY=false`; manually redeploy. Recognized **native-readable ICICI Lombard Product 3005** documents will use n8n as the sole extractor, **without Google OCR fallback**. Unsupported insurer layouts continue their existing OCR path until separate n8n parsers are trained.
7. Monitor failures and reviewer outcomes, and revert quickly with `MODE=off` plus manual Vercel redeployment if needed. Never turn on `ALL_MOTOR=true` until all required insurer/scanned formats have been validated or the business explicitly accepts manual-review-only processing.

**Current release state as of this update:** n8n is **published** with Header Auth; the GitHub branch is **not merged** and the website code is **not deployed to Vercel Production**. The five Vercel Production variables are stored but disabled; the Header Auth secret is missing. No actual signed-URL download of a live customer PDF has been verified via the new deployment, and no production Intake, customer, vehicle or policy record was modified by this integration work.

### Excluding Google later

The user wants n8n to be the main policy parser with ICICI 3005 supported first. Our explicit `required` + `AUTO_ICICI_3005=true` + `ALL_MOTOR=false` selection routes recognized supported PDFs through n8n only, while unrecognized insurers retain their current extraction until their n8n modules are trained. Do **not** globally remove Google or enable `ALL_MOTOR` before the latter layouts are ready. All onboarding and booking safeguards remain in force.
