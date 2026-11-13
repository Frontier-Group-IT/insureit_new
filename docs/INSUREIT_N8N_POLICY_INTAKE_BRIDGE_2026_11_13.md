# INSUREIT Policy Intake ↔ n8n OCR Bridge (draft, 2026-11-13)

## Scope and current state
- n8n Cloud draft workflow: `Iu6WUQiHeGwfDol9` (`INSUREIT - n8n Policy Intake OCR Bridge (DRAFT)`).
- Existing learning workflow `2niTiMr514gUKhR6` remains untouched.
- The n8n draft has a Header Auth webhook node, but **no credential has been assigned and the workflow has not been published**. No live intake or database calls have occurred.
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
