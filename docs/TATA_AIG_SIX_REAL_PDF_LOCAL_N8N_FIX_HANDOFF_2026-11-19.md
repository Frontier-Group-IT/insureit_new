# Tata AIG six real-PDF layout repair — local n8n publication handoff (2026-11-19)

## Exact scope
Four **Bundled Auto Secure - Two Wheeler** documents (1-year OD / 5-year TP, registration printed NEW, Bajaj Chetak electric 4 kW) and two **Auto Secure - Private Car Package** documents (registered HR KIA/HONDA). User PDFs were inspected locally, **not** committed. Six anonymized lookalike fixtures and a replay regression are committed.

The earlier training only admitted private cars, and its strict field regex assumed synthetic line breaks. The existing six database queue records currently show `unsupported_layout` / `n8n_review_required`, 0 verified checks and `processing_lane=manual`. Do not equate this with an unreadable PDF. One attempt per record is recorded; no policy has been modified.

## Code artifacts
- `infra/n8n-local/workflows/tata-aig-real-pdf-parser-v2.js`: native text parser for both table-text orderings, independently 18 checks and itemized premiums. No SQL or booking.
- `infra/n8n-local/workflows/tata-aig-real-pdf-return-v2.js`: web-bridge result normalizer for four Tata parser IDs, review only.
- `apps/web-portal/lib/policy-intake-n8n-validation.ts`: independent strict two-wheeler acceptance; ICICI and original private-car guards retained.
- `apps/web-portal/lib/policy-intake-n8n-layout-eligibility.ts`: recognizes actual 8-page two-wheelers and 12/14-page private-car PDFs.
- `apps/web-portal/scripts/tata-aig-real-layout-regression.mjs` and synthetic fixtures: parser → n8n response node → strict server contract → onboarding mapping, plus negative tests.

## n8n update (not yet published)
Live self-hosted instance only: workflow ID `0uGscm0WUegvxa6V`, authenticated `/webhook/insureit-policy-intake-icici-v1`. Preserve webhook Header Auth credential, signed-source HTTP Request node, ICICI parser branch, all workflow settings and prior active version.
1. Update the IF node **Is Tata AIG Private Car?** condition's **rightValue regex** to:
   `(?:Bundled Auto Secure\\s*-\\s*Two Wheeler Policy|Bundled Auto Secure\\s*-\\s*Private Car Policy|Auto Secure\\s*-\\s*Standalone Own Damage Private Car Policy|Auto Secure\\s*-\\s*Private Car Package Policy)`
   Keep leftValue `={{ String($json.text || '').slice(0,1200) }}`.
2. Replace **Tata AIG Private Car 18-Check Parser** Code node JS with the versioned parser source above. Name may remain unchanged for compatibility.
3. Replace **Return Tata AIG Review-Only JSON** Code node JS with the versioned return source above.
4. Validate the three node configurations. Execute the workflow in **manual testing only** against one synthetic private-car and one synthetic electric two-wheeler case, then ensure 18 checks pass and the return shape passes the website contract. Remove temporary fixture triggers. Retain existing ICICI 13/13 regression.
5. Publish ONLY the audited draft as the active local workflow version, then verify signed-source webhook behavior: unauthorized POST remains 403; public editor/admin remains inaccessible; normal review-only POST remains HTTP 200 for supported PDF. Do not expose any signed link, header secret or raw user policy in logs.

## Controlled website rollout
- Require **Verify web portal** and dependency assurance CI success before PR merge. Vercel production is manually deployed.
- Current production has `INSUREIT_TATA_AIG_N8N_ENABLED=true`, `INSUREIT_N8N_OCR_MODE=shadow`, `INSUREIT_N8N_WORKBENCH_PRIMARY=true`, `INSUREIT_AI_QUEUE_ENABLED=true`. It lacks `INSUREIT_POLICY_OCR_PROVIDER` and `INSUREIT_POLICY_LANE_SPLIT`.
- **Do not flip the two missing flags until n8n has been published, the matching website commit is deployed, and a signed-source read-only smoke test passes.** Flipping lane split early would exclude the six existing `processing_lane=manual` records from the workbench preview. Use existing authorized operator **single-intake review** in shadow mode first; do not run `Reprocess All Previous` or `Convert Verified Candidates` prematurely.
- Once all six have passed review-only extraction, plan a separately authorized, auditable migration of only selected eligible Intake lanes / queue entries. Never auto-book or reassign customers, partners, RMs, or overwrite legacy OCR.
- Keep rollback instructions and prior active n8n version ready. No DNS change or paid service required.

## Current blocker
The connected **INSUREIT Local n8n newer** plugin started returning **The tool failed internally** during the draft-update attempt on 2026-11-19. The code has been committed but the actual local n8n draft was **not** changed/published. Reconnect that local MCP service or restore Docker/tunnel availability before attempting publication.
