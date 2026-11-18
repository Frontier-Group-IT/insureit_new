# ICICI Lombard 3005/O — local n8n release plan (2026-11-18)

## Scope
- Source PR #4774: **review-only** 3005/O parser, version `bridge-od-v1`.
- The original bundled `3005` parser and webhook path remain in place.
- Ten currently open 3005/O Intakes are marked `unsupported/parser_not_trained` in the live queue. Five operator-provided PDFs were checked read-only, all 13/13 OD checks and gross amounts matched.
- **Do not** run any bulk reset, automatic registration, customer write or parser-revision-wide requeue until release checks complete.

## Current environment
- Local Docker n8n editor: `http://localhost:5678`; public HTTPS webhook via `https://n8n.nishant.uk/webhook/insureit-policy-intake-icici-v1` and Nginx 8787.
- Repository workflow snapshot: `docs/n8n/insureit-policy-intake-ocr-bridge.workflow.json` (**inactive draft**, not guaranteed identical to deployed local workflow).
- Dedicated parser source: `docs/n8n/icici-3005-od-parser.js`.
- The connected n8n account is not necessarily the Windows Docker instance; editing a Cloud workflow is NOT a replacement for updating localhost.

## Safe manual rollout
1. Export the currently active local workflow from n8n on Windows and back it up privately (do not share credentials or live signed URLs).
2. Compare its nodes and branch logic with the source-controlled workflow snapshot. Do **not** directly replace the active workflow with the old draft: it may omit locally configured enhancements or credentials.
3. Create a temporary inactive copy inside **local** n8n with a distinct test-webhook path, keeping production `/webhook/insureit-policy-intake-icici-v1` unique and active. Copy the new OD branch of the **ICICI Product 3005 Parser** and the updated **Return INSUREIT Review-Only JSON** node from the reviewed source. Retain the existing signed-Supabase-PDF download path and Header Auth.
4. Verify five uploaded 3005/O PDF samples locally via an authenticated, review-only test; expected each: `ok=true`, `parser_id=icici_3005_od_n8n_native_pdf`, `parser_version=bridge-od-v1`, 13 checks true, gross ₹2,601 / ₹2,696 / ₹3,033 / ₹2,696 / ₹2,774. Also test the previous bundled 3005 PDF: its parser ID, contract and 13 checks must remain unchanged.
5. Test failures: wrong insurer/product, tampered OD totals, changed document revision, malformed signed source, expired signed URL, and missing auth. Fail closed; never auto-book.
6. After the merged web-portal validator is deployed to Vercel, update the **active local** workflow with the same two reviewed Code-node changes. Do not change the public webhook path, Header Auth, Cloudflare Tunnel, or the GoDaddy/Vercel domain configuration.
7. Run one authorized website extraction and verify an actual local n8n **signed-PDF** execution (not just multipart test); confirm OD premium, NCB deductions, TP reference dates, policy number and issuance date on the portal.
8. Requeue ONE previously unsupported 3005/O Motor Intake from the approved AI Policy Studio operator action; verify new `verified` state or a genuine specific exception. Only then reprocess the remaining OD-only candidates. Duplicates and completed policies must remain untouched.
9. Existing `sync_verified_ai_intake_ocr_v1` database RPC hard-codes the bundled parser identity. This PR **intentionally avoids applying that RPC** for OD-only PDFs; OD results stay review-first, using the authorized handoff. A separate, reviewed migration is required before automatic OCR persistence for this new parser.

## Rollback
- Restore the backed-up active local workflow (or the two old Code nodes) and leave the same public webhook path/secret operational.
- Revert the portal release through the approved Vercel deployment workflow if needed.
- Do not modify original PDF Storage objects, canonical policy/customer tables, DNS/nameservers, or previously booked policies.

## Operator status
PR #4774 is implementation/review only. Do not claim the local Windows n8n production workflow was activated solely because CI passed or the PR exists.
