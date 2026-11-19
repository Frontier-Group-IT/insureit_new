# INSUREIT local n8n migration — agent handoff (2026-11-17)

## Goal and non-negotiables

Replace the paid n8n Cloud extraction webhook with self-hosted n8n on the user's Windows Docker host **without paying for another service**. Production website `portal.insureit.in` is **hosted on Vercel**; domain registrar and authoritative DNS currently **GoDaddy**. Do not claim Cloudflare hosts the website. Do not migrate website/DNS unnecessarily. Do not book/modify policies or release pending bulk conversions during the infrastructure migration. Keep an immediate Cloud fallback until live replacement and manual rollback are verified.

**Current outcome**: Local PDF extractor and its public HTTPS connection work in tests. **Production Vercel is NOT cut over**. Existing n8n Cloud configuration remains the last known production endpoint. Quick Tunnel is **temporary testing only** and not a dependable permanent address.

## Repositories, environments, related PRs

- GitHub: `Frontier-Group-IT/insureit_new`; review root `agents.md` before work and use normal workflow checks.
- Production Vercel project: `insureit_new`, project ID `prj_OLXA2UB1LwMd0UidP8MNa1O9MLuq`. Vercel production env contains `INSUREIT_N8N_OCR_WEBHOOK_URL`, `INSUREIT_N8N_OCR_HEADER_SECRET`, `INSUREIT_N8N_OCR_MODE`, and related feature flags. **Do not fetch or disclose secret values and do not overwrite existing Cloud fallback secrets without securely preserving rollback.**
- Source Cloud instance: `https://insureit.app.n8n.cloud`, cloud workflow ID `Iu6WUQiHeGwfDol9`, existing webhook `/webhook/insureit-policy-intake-icici-v1`.
- PR #4770: `chore/n8n-local-parallel-migration-kit-20261117` — initial Docker/PG+workflow import kit (open at time of this handoff). User checked out this branch on Windows.
- PR #4771: `feat/n8n-self-hosted-secure-cutover-20261117` — strict opt-in, self-hosted hostname allowlist and controlled cutover runbook; includes THIS handoff. Cloud is default until environment mode is explicitly changed.
- Other relevant main merges: #4764–#4769 Policy Intake/date/onboarding/OCR error safety. Verify actual live deployment rather than infer from merges.

## Local environment verified on user's PC

Windows PowerShell 5.1, Windows repo folder:

```powershell
cd C:\Users\HP\insureit_new\infra\n8n-local
docker compose -f compose.yaml -f compose.proxy.yaml ps
```

Verified containers at last user report:

- `insureit-n8n-local-n8n-1` — n8n 2.47.6, `127.0.0.1:5678->5678`
- `insureit-n8n-local-postgres-1` — postgres:16-alpine healthy, database private to Docker network
- `insureit-n8n-local-webhook-proxy-1` — nginx:1.27-alpine, `127.0.0.1:8787->8080`

n8n workflow ID: `0uGscm0WUegvxa6V`, local UI at `http://localhost:5678/workflow/0uGscm0WUegvxa6V`, workflow label still `INSUREIT - ICICI 3005 Policy Intake OCR - LOCAL READ ONLY TEST`.

n8n workflow is **Published**, webhook node `Secure Policy Intake PDF Webhook` uses:

- HTTP POST path `insureit-policy-intake-icici-v1` (not the earlier `*-local-test-v1`).
- Authentication: `Header Auth`, credential `Header Auth account`.
- Header name `x-insureit-policy-intake-secret`, secret value private and not in repo/chat.
- Respond: `When Last Node Finishes`; Response Data: `First Entry JSON`.
- Flow: Validate Policy Intake Request → Use Signed PDF Source? → either Download Current Private PDF or Read Policy PDF Text → ICICI Product 3005 Parser → Return INSUREIT Review-Only JSON. Synthetic test trigger also exists in the UI; disable it before full production use.
- This is **review-only** data extraction, no policy booking nodes. Existing policy intake UI has separate guards/review path.

The two **locally created, untracked runtime files** were made manually on Windows; they have NOT been proven committed to GitHub:

`infra/n8n-local/compose.proxy.yaml`:

```yaml
services:
  webhook-proxy:
    image: nginx:1.27-alpine
    restart: unless-stopped
    ports:
      - "127.0.0.1:8787:8080"
    volumes:
      - ./webhook-proxy.conf:/etc/nginx/conf.d/default.conf:ro
    networks:
      - internal
```

`infra/n8n-local/webhook-proxy.conf`:

```nginx
server {
    listen 8080;
    server_tokens off;
    client_max_body_size 16m;

    location = /webhook/insureit-policy-intake-icici-v1 {
        if ($request_method != POST) { return 404; }
        proxy_pass http://n8n:5678;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_connect_timeout 10s;
        proxy_read_timeout 90s;
        proxy_send_timeout 90s;
    }

    location / { return 404; }
}
```

Keep port 8787 loopback bound, NEVER tunnel directly to port 5678. Review Nginx origin forwarding, size limits, and optional rate/concurrency limits before scaling.

## Cloudflare test connection — evidence

Installed `cloudflared 2026.11.0` on Windows and launched:

```powershell
cloudflared tunnel --url http://localhost:8787
```

One public **temporary** URL generated during the session: `https://expert-equal-lean-bull.trycloudflare.com`. It may disappear/change on restart; it is **not a stable production URL**. No DNS or Cloudflare account was required for this test. The user's screenshot showed Nginx 404 via this public hostname.

Security route smoke tests, each reported **HTTP 404** both locally and publicly:

- GET `/` (editor)
- GET `/rest/settings` (admin API)
- GET `/webhook/insureit-policy-intake-icici-v1` (only POST allowed)

Unauthenticated POST to the permitted webhook path returned **HTTP 403** via Cloudflare. This proves tested routes and missing-header rejection; do not assume all HTTP methods, encodings, Nginx aliases or security configurations have been pen-tested.

Authenticated public POST with multipart local `policy-test.pdf` succeeded with **HTTP 200**. PowerShell output confirmed:

- `ok=true`, parser `icici_3005_n8n_native_pdf`
- All 13 parser and financial validation checks passed (13/13)
- `policy_issuance_date=2026-11-15`
- Gross premium `7835` INR; component reconciliation basic OD 2026, zero depreciation addon 766, total OD 2792, TP 3273, CPA 575, net 6640, GST 1195.
- No policy booking or production Intake mutation was performed by this test.

**Important gap**: This proves multipart PDF forwarding; the actual Vercel `requestN8nPolicyIntakeBySignedSource` sends JSON with `signed_pdf_url` pointing to a private, short-lived Supabase Storage object. That signed-source path has **not** been validated over Cloudflare end-to-end. The test PDF contained actual insured details; do not paste responses/URLs/secrets into issues or CI logs.

## Vercel bridge and feature gates

Current code path `apps/web-portal/lib/policy-intake-n8n-bridge.ts`:

- Signed URL restricted to `https://ilzhsfqqjyppzzvfscmh.supabase.co/storage/v1/object/sign/policy-documents/intakes/<intake_uuid>/...` and expected token.
- `INSUREIT_N8N_OCR_WEBHOOK_URL` and `INSUREIT_N8N_OCR_HEADER_SECRET` are server-only.
- Strictly checks allowed HTTPS origin and exact path, disallows query/user/password/hash and redirects, validates response schema.
- PR #4771 adds `INSUREIT_N8N_OCR_ENDPOINT_MODE=self_hosted` selecting only `https://n8n.nishant.uk`; absent or other mode uses Cloud `https://insureit.app.n8n.cloud`.
- **The currently proven Quick Tunnel URL is NOT allowlisted by that PR**, so setting it as Vercel webhook URL would be rejected. Do not weaken SSRF protections to accept arbitrary request-controlled hosts.
- Production Vercel env remains unchanged. Additional mode change and secret value must be configured only once a stable hostname is available. Deploys must follow manual GitHub Actions release workflow; avoid silently turning on Vercel auto-deploy.

## Remaining work — recommended sequence

1. **Check GitHub CI / branches** for #4770/#4771; fix regressions and read `agents.md`. The first #4771 verify run (44136374871) failed because a baseline test expected `EXPECTED_N8N_ORIGIN`; branch subsequently restored that constant while retaining the self-hosted option. Re-run/verify new CI.
2. **Complete security hygiene**: prior Windows screenshots/log upload exposed two randomly generated candidate secrets. Rotate any secret actually used from those screenshots. Existing initialized n8n encryption key must NEVER be blindly edited: credential data becomes unreadable without supported rotation/backup/export strategy. Back up postgres and n8n volumes, validate restore; prevent sensitive PDF/token logging.
3. **Establish a durable free hostname**. Cloudflare Quick Tunnels have no uptime SLA and rotating URLs; **not fit for unattended production**. Named Cloudflare Tunnel with custom `n8n.nishant.uk` is the current intended route and requires Cloudflare DNS authority (plan migration carefully to preserve Vercel and GoDaddy mail/verification records). User does **not** want paid products or unnecessary DNS migration. Investigate any viable free stable alternative before proceeding; explain any tradeoff, do not promise permanent production support from Quick Tunnel.
4. Keep n8n admin UI PRIVATE. Secure Nginx proxy ingress only, Header Auth, exact path, ensure no editor or admin API exposure, domain SSL; test unauthorized/method/size/redirect and public blocked routes. Install named cloudflared connector as persistent service with reboot recovery.
5. **Test actual signed-PDF flow** with one authorized, read-only pilot Intake and freshly generated short-lived signed URL. Never reveal signed bearer URL. Validate `Download Current Private PDF` node, issuance, 13/13 checks, `auto_finalize_allowed=false`, no booking side effects.
6. Verify `N8N_WEBHOOK_URL`, `WEBHOOK_URL`, `N8N_PROXY_HOPS` / forward headers as supported by exact n8n version, while keeping editor on localhost. Never make n8n editor public. Test restart / down / recovery behavior.
7. Coordinate **one-way cutover** after green CI, main merge, approved manual Vercel deployment: set `INSUREIT_N8N_OCR_ENDPOINT_MODE=self_hosted`, strict URL `https://n8n.nishant.uk/webhook/insureit-policy-intake-icici-v1`, and corresponding new private Header Auth secret; preserve old Cloud URL/credential for reversible rollback. Validate live env in **server runtime**, not merely dashboard. Any feature flags for automatic processing must be enabled separately after successful read-only test; no automatic booking.
8. Before scaling, audit the queue, idempotency, request timeouts (bridge 60 s), n8n execution history and partial failures. Keep previously held review-required items on manual hold. Explicitly approve policy changes/bulk booking separately.
9. For rollback: pause producers; restore Vercel Cloud URL+secret and mode `cloud` (or unset), manually deploy; verify only Cloud handles requests; do not simultaneously run two production intake consumers. Keep original n8n Cloud instance until rollout acceptance.

## User preferences / operational constraints

- Keep instructions short and PowerShell 5.1-compatible; user uses Docker Desktop on Windows.
- Do not ask to re-enter anything already established.
- GoDaddy controls domain DNS, **Vercel hosts the production website**.
- Cost saving is the primary driver: avoid paid ngrok, VPS or subscription as a hidden dependency.
- Current local Windows host is a reliability limit: sleep, Docker Desktop, home network or electricity outage interrupts automation. Do not claim production-grade uptime.
- User authorized migration and eventual connection, but this does not imply permission to bypass the defined production tests/security checks or to book policies.


## Update — 2026-11-18: ICICI 3005/O OD + 3005 automatic parser integration

**Status at this handoff:** The separate local **candidate** successfully processes one genuine OD PDF and one bundled test PDF end-to-end over its test webhook; 13/13 checks passed in each case. **Do not infer that live production website integration has been released or validated.** The actual live webhook remains `/webhook/insureit-policy-intake-icici-v1`, behind loopback port 8787. Candidate remains isolated and unpublished unless subsequently verified and deliberately switched.

### Current components and exact IDs

- Local user PC: `C:\Users\HP\insureit_new\infra\n8n-local`; n8n editor `http://localhost:5678`, database Postgres in Docker. Local original production workflow ID `0uGscm0WUegvxa6V` (re-verify its current publish state). Original OD-only local draft ID `fH39HvXHTeSKGJ2F`; dual-parser **candidate workflow ID `ETTaxqnhhktuFavz`**.
- Candidate named **INSUREIT - ICICI 3005 + 3005-O Auto-Detect - Local Candidate**. Test webhook `POST http://localhost:5678/webhook-test/insureit-icici-3005-auto-local-candidate-v1`. Separate from the production webhook; do not publish under production route until website compatibility and rollback verified.
- Local files: `C:\Users\HP\insureit-n8n-backup\icici-3005-od-local-fixed.json`; `C:\Users\HP\insureit-n8n-backup\icici-3005-dual-parser-candidate.json`; preparation script in Downloads `prepare_insureit_3005_dual_parser.ps1`. User imported candidate via n8n UI. These are *local files*, not guaranteed committed or automatically synchronized with Cloud.
- n8n Cloud **development-only** dual parser draft `https://insureit.app.n8n.cloud/workflow/CANYTNXLSxnMfFyd` was updated to explicitly detect `3005/O` vs `3005` and fail-closed for unknown products; it remained inactive. Cloud execution through MCP returned **execution quota reached**, so do not claim the Cloud draft was executed successfully.
- Website compatibility draft PR **#4798** `feat/icici-3005-od-auto-routing-20261118`: `https://github.com/Frontier-Group-IT/insureit_new/pull/4798`. Adds OD response validation with independent TP reference dates, strict 3005/O policy numbers, OD subtotal minus NCB reconciliation, TP/CPA zero, and regression fixtures. No automatic finalization. Merge and manual production deployment only after current required GitHub CI checks pass.

### What was implemented and actually tested locally

1. The incoming PDF is validated for UUID request IDs, passed on as binary `data`, converted to text by `Read Policy PDF Text`, then the parser dispatches on policy code:
   - Product `3005/O`: `icici_3005_od_n8n_native_pdf`, version `bridge-od-v1`.
   - Bundled product `3005`: `icici_3005_n8n_native_pdf`, version `bridge-v1`.
   - Unknown code: `validation_passed=false`, manual review; not treated as a valid automated extraction.
2. The real PDF `C:\Users\HP\Downloads\od icici.pdf` is ICICI 3005/O policy ending **462448679**, insured **MITHLESH SINGH YADAV**. PDF layout uses separate label and value rows; the corrected `normalizeOdPdfText` fixes missing insured/vehicle/dates/TP refs and reconstructs itemized OD premium table. Original OD-only parser initially failed 7 of 13 checks; corrected OD-only workflow and dual candidate subsequently returned **all 13 checks true, no warnings**, `ok=true` in final webhook response.
   - Extracted OD 2026-11-15 to 2027-11-14; issued 2026-11-13; make BAJAJ; model CHETAK 2413 PREMIUM; electric 4 kW; IDV 106760; manufacture 2023; RTO state MADHYA PRADESH and name MADHYA PRADESH-JABALPUR. Existing TP reference 2023-10-16 through 2028-10-15. Basic OD 2222 + Zero Depreciation Silver 907 = subtotal 3129; less NCB 778 = net OD 2351; exact IGST 423.18 / printed 423 = gross 2774; new TP and CPA charged 0.
3. Bundled `C:\Users\HP\Downloads\policy-test.pdf` ran through the **same candidate** (green nodes from webhook through final JSON; HTTP 200); 13/13 bundled checks true and no warnings; basic OD 2026 + Zero Depreciation 766 = OD 2792, TP 3273, CPA 575, net 6640, exact GST 1195.2, printed GST 1195, gross 7835. A final paste omitted the bundled `parser_id` itself; checks `is_icici_3005=true` imply bundled detection, but confirm exact ID if release gate requires it.
4. During earlier tests, clicking **Listen for test event** on just the trigger returned input headers and no downstream processing; executing the **whole canvas workflow** and then POSTing the test URL resulted in successful end-to-end parsing. Test URLs are one-shot; 404 after one test normally means restart listener. Avoid recording raw request headers in tickets/screenshots. The user's screenshot and PowerShell response confirmed the candidate graph was fully green.
5. Candidate connections: Webhook -> Validate -> Signed Source IF; false branch -> Read PDF Text; true branch -> Download Current Private PDF -> Read PDF Text; Read PDF Text -> Parser -> Return INSUREIT Review-Only JSON. Synthetic manual trigger remains disabled.

### Remaining production blockers and release procedure

- PR #4798 CI: first `Verify web portal` run ID **44258679479** **failed** in `policy-intake:workflow-regression` because `policy-intake-n8n-bridge-regression.mjs` had a static assertion insisting on only `value.parser_version !== "bridge-v1"`. This test has been updated in the PR branch to recognize both `bridge-v1` and `bridge-od-v1`; **verify the fresh CI run**, including regression, typecheck, lint, build. Never merge with failed checks.
- The website expects a **normalized review-only signed-source JSON response**, with `contract_version=1`, matching identity IDs, `ok=true`, `review_required=true`, `auto_finalize_allowed=false`, `extraction_method=native_pdf_text`, supported `parser_id`/version, fields, checks and reconciled premium components. Confirm OD output meets it and that the browser onboarding flow maps OD fields; `vehicle_rto_city` isn't in the OD proposal (state is). No new policy booking or customer writes by the parser itself.
- **Critical test gap:** Real website uses `signed_pdf_url` pointing to a temporary private Supabase Storage URL, not the multipart PDF used for candidate tests. Test the IF **true branch** with an authorized single-intake pilot *without logging token URL* and ensure the final response satisfies strict server-side validator. Don't assume multipart success proves signed-source works.
- Local candidate is **not** the live `/webhook/insureit-policy-intake-icici-v1` workflow. Production nginx whitelist only allows the existing webhook, and the candidate URL is local test-only. After CI/website deployment, back up the existing published n8n workflow, apply the verified candidate parser/response safely to the existing local live workflow, retain its exact webhook path and credential, publish only after both product types and signed-source pass. Verify local port 8787 route, public Cloudflare route, host's uptime and no edit/admin exposure. Ensure one active handler for the URL; preserve rollback JSON.
- **Routing / hosting caveat:** Website bridge originally defaults to n8n Cloud and has strict self-hosted opt-in origin `https://n8n.nishant.uk`. A named Cloudflare Tunnel is reported for the Windows host, with webhook routes `n8n.insureit.in` and `n8n.nishant.uk`; do NOT confuse the separately configured MCP hostname `mcp.nishant.uk` on 8788 with the policy webhook on 8787. Check **actual live** server environment `INSUREIT_N8N_OCR_ENDPOINT_MODE`, URL/secret and feature gates in Vercel/hosting (never disclose secret values), and verify which production host/provider is serving portal before any cutover.
- Preserve old Cloud workflow, old original local workflow, and existing Vercel env/fallback until a complete authenticated website preview + manual rollback smoke test. Make the portal change through approved manual GitHub Actions after merge; no silent auto-deploy, policy creation, or bulk booking.
- Local n8n logs had proxy-trust `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR`, occasional `Inbound authentication denied`, PDF.js `standardFontDataUrl` and `TT` warnings, and one `Slow database query`. None proved the parser had failed; investigate proxy hops separately and do not casually restart/modify production services during testing.

### Commands used for test (credential values omitted)

```powershell
# From Windows PowerShell after starting Execute workflow in the candidate canvas:
$url = "http://localhost:5678/webhook-test/insureit-icici-3005-auto-local-candidate-v1"
$pdf = "C:\Users\HP\Downloads\od icici.pdf" # change to policy-test.pdf for bundled
$secret = Read-Host "Enter LOCAL Header Auth secret"
curl.exe -sS -X POST "$url" `
  -H "x-insureit-policy-intake-secret: $secret" `
  -F "intake_id=00000000-0000-4000-8000-000000000001" `
  -F "document_id=00000000-0000-4000-8000-000000000002" `
  -F "request_id=00000000-0000-4000-8000-000000000003" `
  -F "data=@$pdf;type=application/pdf" `
  -o "$env:TEMP\dual-parser-result.json" `
  -w "HTTP %{http_code}`n"
$result = Get-Content "$env:TEMP\dual-parser-result.json" -Raw | ConvertFrom-Json
$result | Select-Object ok,parser_id,parser_version
$result.checks | Format-List
```

**Operational decision:** full dual-parser candidate testing has passed via multipart PDF locally, while website full signed-source, CI, production publication and rollback validation remain release gates. Do not mark deployment complete solely because the candidate returns HTTP 200.


---

## Update — 2026-11-19: actual self-hosted production journey, parser training, operations separation

> **Read this dated section first in a new chat.** Earlier Nov 17–18 sections are historical snapshots. In particular, their statements “production Vercel NOT cut over”, “candidate not published”, “no live signed-source execution” are **superseded by subsequent user reports and actual logs**. Do not overwrite this existing handoff; preserve chronological evidence. Distinguish reported deployment from independently verified checks.

### Confirmed topology and working resources

- Project/repo: \`Frontier-Group-IT/insureit_new\`, production \`https://portal.insureit.in\` on **Vercel**. \`insureit.in\` remains GoDaddy; NEVER switch its authoritative nameservers merely for n8n. Separate free Cloudflare Tunnel hostname \`n8n.nishant.uk\` routes only POST policy webhook to local Docker nginx \`127.0.0.1:8787\`. \`mcp.nishant.uk\` on 8788 is **MCP**, not the policy webhook. Do not expose editor/admin endpoints.
- Windows host: \`C:\Users\HP\insureit_new\infra\n8n-local\`, n8n \`2.47.6\` on \`http://localhost:5678\`, Docker Postgres 16 and reverse proxy. Actual live n8n workflow \`0uGscm0WUegvxa6V\`; POST path \`/webhook/insureit-policy-intake-icici-v1\`; private Header Auth \`x-insureit-policy-intake-secret\`. User explicitly reports publishing patched parser and later reprocessing through the website. Do not claim complete provider cutover without checking live server env and fresh signed-PDF execution.
- n8n Code nodes \`ICICI Product 3005 Parser\` and \`Return INSUREIT Review-Only JSON\`. Nodes: webhook → request validation → signed-source IF → either private PDF download or direct multipart data → PDF text extraction → auto-detect 3005 vs 3005/O → strict review JSON. Header secret and Supabase signed URL are bearer credentials: never paste values, screenshots of signed URL, raw response bodies or customer PII in public logs/docs.
- Read-only parser response contract: \`contract_version:"1"\`, exact \`intake_id\`, \`document_id\`, \`request_id\`, \`ok:true\` only after 13 parser/math checks, whitelisted parser ID and version, \`extraction_method:"native_pdf_text"\`, \`review_required:true\`, \`auto_finalize_allowed:false\`, appropriate fields + \`premium_components\`. A 200 alone is NOT success; inspect final response and every check.

### Timeline of code releases, observed results, and limits

1. **Nov 17:** Moved off rate-limited n8n Cloud to local Docker, named free Cloudflare Tunnel \`n8n.nishant.uk\`; secret-protected public POST worked. Supabase signed source + Google fallback initially still needed proving.
2. **Nov 18:** Two parser identities validated: Bundled \`icici_3005_n8n_native_pdf\` / \`bridge-v1\`, and Stand-Alone Own Damage \`icici_3005_od_n8n_native_pdf\` / \`bridge-od-v1\`. Independent TP reference dates, true NCB deductions, 13/13 arithmetic, zero TP/CPA on OD. Website validator PR **#4798 merged**, user reports manual website deployment. No auto-finalize.
3. **Nov 18:** Production DB migration \`20261118103431_icici_3005_ai_verified_ocr_sync_v2.sql\` **applied** and verified service-role-only. PR **#4806 merged**, guarded revision/document/lease OCR synchronization, manufacturer alias and OD CPA/NCB logic. PR **#4814 merged**, authorized automatic reviewer takeover and independent electric motor kW (never seats as kW). PR **#4826 merged**, explicit legacy-draft PDF issue-date comparison and revision-bound correction, fill-blank canonical policy fields, CPA amount/opt-in parity; user reports deployment. These are *website changes*, NOT automatic updates to Windows n8n.
4. **Nov 19:** Three initially rejected ICICI PDFs tested with patched **inactive local candidate**, each \`ok:true\`, 13/13 checks, zero missing fields/warnings. Results: ordinary 3005/O ₹3,181; 3005/O B00 (two add-ons/NCB) ₹2,434; company-owned Bundled (three add-ons, CPA zero) ₹7,212. Production parser was subsequently edited/published by user. Additional Chetak 3001/3501/3502 model fix prepared after website still returned \`n8n_review_required\` for four Bundled Intakes, and offline PDF text replay reportedly 12/12 passing; **check that this latest v2 model patch is actually installed/published on Windows and validated with the real Test URL**. No claim all variants or insurers trained.
5. **Nov 19:** Portal-generated signed PDF download errors: original \`Download Current Private PDF\` node \`ECONNABORTED\` at 20,000 ms; manually replaying an old failed execution reused an expired 120-second signed Supabase URL, resulting \`InvalidJWT/exp\`. These are **different** root causes; retry via a **fresh website request**, not n8n “Retry execution”. Suggested node timeout **45,000 ms**, below website 60-second bridge; not proof until fresh end-to-end signed-source test. Docker-only connectivity test \`fetch(https://ilzhsfqqjyppzzvfscmh.supabase.co/storage/...nonexistent public file)\` returned HTTP 400 in 1,132 ms: reachable, not a real private-PDF bandwidth proof.
6. **Nov 19:** AI workbench still showed some \`parser_not_trained\` for ICICI with \`last_error_code=n8n_review_required\`, strict website rejected \`ok:false\`. Other errors: \`booking_review_required\` for \`PIR-261116-C805CB\` after extracted fields applied; \`email_date_approval\` for \`PIR-261111-0C53DA\`; duplicate \`PIR-261116-395DFA\`. Do not bypass the latter safeguards. An earlier bundled set \`PIR-261117-63FB51\`, \`689892\`, \`D0A750\`, \`PIR-261107-9A5976\` has PDF layout Chetak 3502/3001/3501, each with CC/KW 4.2 explicitly printed, old parser rejection \`n8n_review_required\`. User-provided v2 Chetak parser ZIP/JS must be tested on actual local published workflow.
7. **Nov 19 two conflicting certificates:** exact chassis \`MD2C59208TAG86977\`, engine \`E20ATG90759\`, model Chetak 3503, issue 2026-11-05, same gross ₹7,215 and OD+TP coverage, but two policy numbers/named insured:
   - \`3005/461440415/00/000\`, **Maneesha Patel**: INSUREIT intake \`PIR-261116-9BAD3E\`, **completed**, linked to INSUREIT active policy and customer/vehicle.
   - \`3005/461441787/00/000\`, **Ashish Sahu**: INSUREIT intake \`PIR-261116-C805CB\`, **in_review**, not registered, queue \`booking_review_required\`, existing draft.
   - Database active status is **not insurer-side validation**. Actual insurer validity **cannot be decided from PDFs or internal register alone**; require ICICI Lombard confirmation of active/cancelled/superseded documents and vehicle owner. Keep active INSUREIT record unchanged, freeze second booking, never bypass chassis ownership, avoid automatic cancellation/transfer/customer overwrite. Preserve auditable manual resolution.

### Critical ongoing work: user-approved architecture goals (Nov 19)

**A. Completely replace Google Document AI extraction with self-hosted n8n, including “Read” in standard Motor Policy Onboarding, plus Intake automatic parsing.**

- Existing website is **not globally cut over**. Current Intake path \`apps/web-portal/app/policy-intakes/actions.ts\` invokes \`extractPolicyIntakeWithN8nFallback\` in \`apps/web-portal/lib/policy-intake-n8n-router.ts\`; unless forced/recognized/queue-enabled, it may still call Google. Current **manual onboarding Read** in \`apps/web-portal/components/policy-ocr-import-panel.tsx\` calls \`extractAndStagePolicyDocument\` → \`extractPolicyDocument\` in \`apps/web-portal/app/policies/policy-ocr-actions.ts\`, which **directly invokes Google Document AI**. Training workers in that same file also use Google; do not assume disabling one Read route disables all Google paths.
- Use **one strict n8n-only provider gate** for manual Read plus Intake extraction (file type PDF, 15MB, server Header Auth, HTTPS exact allowlist). Keep human-entered/manual onboarding available when untrained or image-only documents cannot parse. **Never silently fall back to Google**, invent values, suppress failures or automatically register. There are currently only validated ICICI Motor product 3005 and 3005/O parsers; other insurers need separate n8n training and validation. Keep old Google credentials dormant during rollback window; disable workers/scheduled Google jobs as part of eventual hard cutover, after verifying they have no outstanding jobs.
- Website may send fresh signed URL for a stored current Intake. Ad-hoc Policy Onboarding “Read” has an uploaded PDF and may use the existing n8n multipart \`requestN8nPolicyIntakeExtraction\` with fresh request/document UUIDs, **but no DB policy/intake should be created by a pure Read**. Adapt verified field/result conversion without bypassing strict IDs, required checks, and safe failure. Verify Image/JPG/PNG behavior explicitly (n8n native PDF parser cannot read these until trained); show manual entry instead of Google fallback.
- Beware env: \`isN8nWorkbenchPrimary()\` currently requires \`INSUREIT_N8N_WORKBENCH_PRIMARY=true\` and \`INSUREIT_N8N_OCR_MODE="shadow"\`. Flipping \`INSUREIT_N8N_OCR_MODE=required\` blindly can **disable queue + workbench**. Define a tested compatible cutover plan; don't change production env by assumption.

**B. Separate Operations manual Intake from AI automation workflow.**

- Both \`/policy-intakes\` and \`/development/ai-policy-onboarding\` currently query **the same** \`policy_intake_requests\`. AI workbench queries open rows and queue; manual register queries all rows. Status-only UI filtering does NOT constitute isolation.
- Target **two explicit tabs/queues**: “AI Automation” (n8n queue, reprocessing, verified drafting, human approval) and “Manual Onboarding” (Operations claims, edit, review, complete). Preserve audit visibility to authorized admins and linked policy register; avoid hiding final policy history. Define a persisted **processing lane/ownership** assignment (or an equally reliable authority), distinguish legacy open records; ensure queue claim, reviewer actions, handoff, links, counts, and row-level server guards respect it. Manual operations users should not claim/edit/override AI lane without authorized transfer; AI lane must not create policy automatically or overwrite a manual draft. Transfer between lanes requires explicit authorized, auditable action; no silent default moving existing policies.
- Never classify based solely on the fact that both pages display the same Intake or a queue row: queue previously processed unsupported insurers as well as ICICI. Preserve partner app and partner submission visibility, permissions, approved user scopes, duplicates, status counts and completed records.
- Delivery via separate branch/PR, GitHub CI, approved Supabase migration (if needed) and **manual** Vercel website deployment. Avoid changing GoDaddy DNS, local Docker provider secrets or actual policy register as part of UI change. No background promises.

### New chat operating procedure / release gates

1. Read **THIS handoff** and \`AGENTS.md\`; inspect actual \`main\`, open PRs and CI before code changes. Do not trust prior statement “deployed” as proof of current code commit without current Vercel verification.
2. Confirm production n8n published workflow and test with whole-workflow Execute, separate candidate/webhook-test, and 3+ variant PDFs. Test fresh signed-source from website, network timeout/expiry, Header Auth, errors, and negative unknown-insurer cases. Do not replay expired source.
3. Train insurers **one at a time**: collect representative real PDFs, anonymize test fixtures, implement independent \`parser_id\`/version and 13+ evidence/math checks, preserve strict user consent and authority. Test offline PDF text, then inactive Docker n8n candidate, then published server and signed-source website Read. Never use model/fuel/date/premium guesses.
4. For customer/vehicle conflicts, compare identity, engine/chassis and historical policies. Existing vehicle with different named owner means **hold for human decision**, even if PDF 13/13. Confirm active insurer policy and audited transfer before any booking; no one-click override.
5. Do not bulk retry previously registered/duplicate/cancelled policies; do not touch Go Digit, United India, New India, Tata AIG n8n training until their own parser is ready; keep manual path.
6. Protect all secret tokens/PDFs, preserve rollback exports, confirm manual GitHub Actions deploy, queue-worker pause/resume and live health. Win Docker host sleeping/offline stops local n8n: do not promise uninterrupted 24/7 automation.

### Nov 19 implementation update — PR #4866 (not yet released)

- **Branch**: `feat/n8n-primary-policy-lanes-handoff-20261119`; **draft PR**: https://github.com/Frontier-Group-IT/insureit_new/pull/4866. Latest code head before this Markdown update `637af05fc3f47e9be68ee0a9d9dc2ff35e58d3ea`. Web Portal CI **passed** regressions, TypeScript, lint and production build; dependency-assurance workflow also passed. Recheck CI against the latest PR head before release.
- **Prepared (NOT production deployed):** `INSUREIT_POLICY_OCR_PROVIDER=n8n` routes standalone Policy Onboarding **Read** through the existing signed/validated local multipart n8n webhook; new and stored Intake OCR no longer silently calls Google. Legacy Google OCR training workers refuse work under this switch. Untrained/image-only policies require **manual onboarding** until another insurer's local n8n parser passes strict tests.
- **Prepared (NOT migrated to production):** `INSUREIT_POLICY_LANE_SPLIT=true` uses migration `supabase/migrations/20261119082721_policy_intake_processing_lanes.sql`, explicit `manual|automation` lane, restricted v3 queue, separate visible IT tabs and Operations server protections. Partner, POSP, MISP and Branch original/replacement APIs now assign/preserve the same lane, avoiding silent loss of partner automation. Current queue in production had 139 open items, but only 23 recognizable open current-document ICICI candidates for the initial automation-lane backfill.
- **Safety:** no existing booked policy changed, no disputed vehicle cancellation/transfer, no local Docker workflow updated, no Supabase migration applied and no Vercel deployment from PR #4866. PR remains **draft/unmerged** pending migration review, explicit cutover controls and smoke tests.
- **Required rollout order:** (1) record current queue counts, permissions and v2 rollback baseline; (2) review/apply lane migration using approved Supabase migration process, verify v3 permission and 23 known-candidate initial split; (3) recheck PR latest checks, approve/merge and deploy via manual GitHub Actions; (4) verify production exact `n8n.nishant.uk` service, current Header Auth, and fresh private signed-source PDF flow; (5) opt in `INSUREIT_POLICY_LANE_SPLIT=true` and `INSUREIT_POLICY_OCR_PROVIDER=n8n` server-side, keeping `INSUREIT_AI_QUEUE_ENABLED=true`, `INSUREIT_N8N_WORKBENCH_PRIMARY=true`, and compatible `INSUREIT_N8N_OCR_MODE=shadow`; (6) smoke test both manual and AI Intake permissions, Partner submissions, Policy Onboarding Read and untrained insurer fail-closed; (7) examine remaining Google schedules/worker triggers before disabling provider accounts. Do not rotate or expose n8n encryption secrets by guessing.
- **Future training:** new insurers need their own approved parser ID/version + complete field/check contract in the website validator, premium mapping, local n8n Code nodes and golden policy fixture tests. The current server validator is intentionally ICICI 3005/3005-O only. Do not claim all insurers are already supported.


---

## 2026-11-19 continuation — hardening PR #4866 and release truth (read first)

**This section supersedes any earlier claim that new Motor Intakes always enter automation.** PR [#4866](https://github.com/Frontier-Group-IT/insureit_new/pull/4866) is the rollout branch `feat/n8n-primary-policy-lanes-handoff-20261119`. It implements opt-in n8n-only Policy Onboarding Read, separate AI/Manual Intake lists and guarded queue-v3, but the application **must not be called live until database migration, protected configuration, deployment and authorized tests are independently verified**.

### New Intake routing (updated)
- A new Motor PDF enters `processing_lane='automation'` only when `INSUREIT_POLICY_LANE_SPLIT=true`, `INSUREIT_POLICY_OCR_PROVIDER=n8n`, the AI queue is enabled, and its actual stored digital PDF carries **ICICI LOMBARD** insurer-header evidence plus **Product Code 3005 or 3005/O**. The check is `isTrainedLocalN8nMotorPdf`; it uses native text only, has a 15MB bound, never calls Google and fails closed to `manual` for unknown, encrypted, scanned, corrupt, unsupported or untrained files.
- This applies to **both** Operations Web and Partner/POSP/MISP/Branch uploads. Intakes in the manual lane are not automatically claimed by queue-v3, preserving Operations review and preventing automatic n8n reprocessing of untrained insurers. Training a new insurer requires updating **both** the local n8n parser/response validator and the explicit supported-layout detector in a reviewed PR, then rerunning fresh-sibling PDF tests.
- For existing rows the reviewed migration only backfills current-document, open ICICI 3005 queue candidates; historical unsupported insurers and completed Intakes remain manual. A queue row by itself is NOT an automation assignment. Existing registered policies remain unchanged.
- **IT-only exception transfer:** an authorized IT Super User/Super Admin can use the custom confirmation in the AI workbench to move a *terminal* `unsupported`, `exception` or `failed` Intake to Manual Onboarding. The transfer RPC `move_policy_intake_automation_to_manual_v1` acquires database row locks, rejects pending/processing/verified/duplicate/closed/registered Intakes, and appends actor plus reason in `audit_logs`. It preserves PDF, OCR, customer, reviewer and policy data and never books. Manual Operations does not receive a transfer button or permission to steal AI work. No automatic lane transfer happens merely on parser failure.
- A rollback that disables lane-split can allow legacy queue-v2 to see manual records again. **Pause the AI queue worker before such a rollback**, verify the historic queue and only restart an authorized consumer after explicit reconciliation. Never run v2 and v3 consumers simultaneously.

### Vercel and n8n verification gaps as of this continuation
- Vercel production project ID `prj_OLXA2UB1LwMd0UidP8MNa1O9MLuq` has existing n8n endpoint-mode, webhook URL, private header secret, queue and workbench settings; `INSUREIT_POLICY_OCR_PROVIDER` and `INSUREIT_POLICY_LANE_SPLIT` were **not present** in the production environment listing before this continuation's release steps. No secret values were read or printed. The last verified READY production commit was PR #4826 `d64c683a64fd0ca98041f58b3932a783ca3db8d4` before any new rollout.
- The available connected n8n integration **points to old n8n Cloud** (workflow IDs `Iu6WUQiHeGwfDol9`, `CANYTNXLSxnMfFyd`); requesting local workflow ID `0uGscm0WUegvxa6V` returned inaccessible/not found. **Thus no new local Windows Docker workflow was read, modified, published or end-to-end tested via that integration.** Local publish status, latest Chetak fix, HTTPS tunnel uptime and actual signed-PDF download must be tested through the Windows-hosted instance/appropriate MCP connection. Do NOT silently substitute Cloud workflow testing.
- A green GitHub `Verify web portal` run is static/build evidence, **not** proof of complete source-PDF Read, real onboarding apply, partner scope, or no Google network traffic. Verify the exact latest PR HEAD run after the final hardening commit before merge.

### Safe production sequence (no secrets in handoff)
1. Inspect latest PR #4866 HEAD, GitHub checks and required review; confirm the local published workflow accepts current-day **fresh signed Supabase PDF** and **multipart Read** requests, both ICICI 3005 variants with 13/13 checks, zero warnings, exact identifiers, and no booking nodes. Negative tests: untrained PDF, scanned image, expired signed URL, invalid secret and unauthorized access. A re-run of a stale n8n execution is not a valid fresh-source test.
2. Back up Supabase schema/affected open Intake identifiers and the existing local workflow/volumes and production environment settings. Verify actual current-document and lane-backfill counts (previous read-only baseline **139 open queued Intakes, 23 eligible ICICI candidates**). Apply reviewed `20261119082721_policy_intake_processing_lanes.sql` using the approved production migration flow and verify `processing_lane`, queue-v3 service-role grant, move-to-manual grant and audit insert. Do not reclassify completed or registered policies.
3. After CI and schema parity are green, merge reviewed PR and use the **existing manual-only GitHub Actions Vercel production release**; do not turn Git auto-deploy on. With both new feature flags absent/false, the new code is inert and must not claim an OCR cutover.
4. Verify server-only endpoint mode `self_hosted`, exact `https://n8n.nishant.uk/webhook/insureit-policy-intake-icici-v1`, private Header Auth, local nginx port 8787 and tunnel. Enable `INSUREIT_POLICY_OCR_PROVIDER=n8n` and `INSUREIT_POLICY_LANE_SPLIT=true` only in a controlled release after local parser tests and approved runtime checks. Keep `INSUREIT_N8N_WORKBENCH_PRIMARY` and `INSUREIT_N8N_OCR_MODE=shadow` compatible with the existing queue/workbench.
5. Re-deploy if environment changes require it. Validate authenticated Web Read, Partner upload, manual-only register, IT-only automation register, IT terminal-failure transfer with audit record, and HTTP failure/manual fallback without Google. Confirm duplicate, ownership, prior-month email OTP, CPA, customer identity and financial review guards.
6. Leave Google Document AI credentials available but dormant for an emergency rollback window. Disable Google OCR/training schedules only after the n8n-only provider flag and live no-Google path are confirmed. Do not remove Google code or credentials until confirmed acceptance; no automatic policy booking.
7. **Next insurer training** requires representative PDFs and access to the **local** published/candidate n8n workflow. Follow `docs/INSUREIT_POLICY_OCR_AUTOMATED_TRAINING_SKILL.md`: current insurer header -> distinct product/layout -> text/structured rows -> exact vehicle/financial evidence -> 13+ validation -> synthetic + fresh sibling tests -> private signed-source website Read -> reviewed mapping and explicit human approval. Never claim existing Google-trained insurer-specific refiners are automatically compatible with native n8n.

**Evidence vocabulary:** Prepared code, green CI, merged, migration applied, Vercel READY, flags active, live n8n verified and customer/policy booked are *different* states. Record each separately.


---

## 2026-11-19 verified database application (supersedes earlier *not applied* notes)

- **APPLIED** to Insureit_Pro_Plan production Supabase project `ilzhsfqqjyppzzvfscmh` via the version-recording Supabase migration flow. Actual recorded version is `20261119082721`, migration `policy_intake_processing_lanes`; the repository file has been renamed to `supabase/migrations/20261119082721_policy_intake_processing_lanes.sql` to maintain release parity. Do NOT reapply under the old future timestamp or re-run the historical backfill.
- Read-only post-apply counts: **23** existing open Intakes in `automation`, **116** remaining open in `manual`, **1,530** total manual historical/closed/open Intake records. All **139** previously open cases remain. Exactly **23** `policy_intake_lane_backfilled` audit entries created; **zero** completed/registered policies entered automation.
- Verified `claim_policy_intake_ai_queue_v3` and `move_policy_intake_automation_to_manual_v1` exist, queue v3 is executable by `service_role` but **not** `authenticated`, and transfer RPC is **not** executable by `authenticated`. No policy was booked, cancelled, transferred or deleted by the migration.
- **NOT YET RELEASED:** the web PR merge, manual Vercel production deployment, activation of `INSUREIT_POLICY_OCR_PROVIDER=n8n` or `INSUREIT_POLICY_LANE_SPLIT=true`, Windows-local n8n signed-source/multipart recheck, and authenticated two-register UI tests are independent unfinished gates. Existing website remains on the earlier deployment until verified otherwise.
- Emergency rollback: keep split flags **off**, pause the AI queue producer/consumer, review audit history and explicitly reconcile the 23 lane assignments before changing them; preserve the audit log. Do not run v2 and v3 workers together.


---

## 2026-11-19 GitHub release checkpoint — PR #4866 merged (separate from deployment)

- **MERGED into `main`**: PR [#4866](https://github.com/Frontier-Group-IT/insureit_new/pull/4866), squash merge commit `e4659aadea2157645bf89a03c4fe1c81499cee47`. The exact final PR head `c5bdc7d70f14382bb1d81044cabce9c139f59ca2` passed both `Verify web portal` and `INSUREIT dependency assurance evidence` GitHub checks. Included: Google-to-local-n8n provider gate for Read + Intake, native ICICI 3005/3005-O eligibility for new automation Intakes, separate AI/Manual pages and server actions, audited manual-transfer controls, service-only v3 queue and migration-historical audit.
- **APPLIED (database only):** `20261119082721_policy_intake_processing_lanes.sql` in project `ilzhsfqqjyppzzvfscmh`. Verified 23 open AI and 116 open manual, 23 backfill audits, zero completed/registered in automation, and queue/transfer RPCs inaccessible to ordinary authenticated users. Do not re-run the migration or claim it is still pending.
- **NOT DEPLOYED:** Vercel latest recorded READY production source remains `d64c683a64fd0ca98041f58b3932a783ca3db8d4` (PR #4826), not merge `e4659aadea2157645bf89a03c4fe1c81499cee47`. The user-selected manual Actions release is still necessary. **Neither** `INSUREIT_POLICY_OCR_PROVIDER=n8n` nor `INSUREIT_POLICY_LANE_SPLIT=true` was configured in production at verification. The public Policy Onboarding Read and Intake tabs therefore have not switched as part of this PR.
- **RUNTIME BLOCKER:** The connected n8n MCP lists original n8n Cloud workflows and cannot access Windows-local workflow ID `0uGscm0WUegvxa6V`; no authorized live signed-source or multipart PDF check could be performed through that connection. Verify live local published parser, 13/13 checks, latest Chetak variants, fresh signed-source URL, 403 missing header, editor/admin 404, and Cloudflare Tunnel uptime before enabling n8n-only routing.
- **Do not enable** the two feature flags or retire Google until fresh end-to-end tests, protected local host and rollback are established. Do not auto-book or change customer/vehicle ownership. Next training needs representative policies and access to the user's Windows-hosted local n8n or its securely connected MCP, not the old Cloud workflow.


---

## 2026-11-19 afternoon — corrected open Intake counts and local MCP connection

### A. Meaning of "open" (verified against live production, after one newer intake)

- The earlier "139 open" was **not** 139 actionable policies: the count checked status + unbooked but ignored canonical duplicate detection.
- Fresh database snapshot: **140** status-open and unbooked rows; **132** canonical policy-number duplicates; **8** actual nonduplicate open cases. By lane: **3 AI Automation** / **5 Manual Onboarding**; 20/23 automation opens and 112/117 manual opens are derived duplicates. The previously quoted 139/23/116 was a prior snapshot, not a permanent number. These figures are dynamic.
- Derived duplicate is decided by `loadPolicyIntakeDuplicateMatches`: normalized insurer policy number matched against registered policies or an earlier Intake. Do NOT delete, auto-book, reject, move, reprocess or modify historical data to fix a count. A suspicious same-chassis/different-policy-number identity conflict is NOT automatically a canonical policy-number duplicate; it requires human/insurer verification.
- Queue UI adjustment: Operations/POSP list gets `All Open` (action required + in review + processing, **excluding duplicates**) plus a separately labelled `All Records` for historical visibility. Completed/Rejected/Duplicate retain their distinct tabs. AI workbench's `All Open` count and list similarly exclude duplicates; `Duplicate` remains historical/read-only. No mutation of recorded statuses or financial data. The cross-app `policyIntakeStatusCounts` contract remains unchanged; open is derived locally from effective buckets.

### B. MCP hostname (not the policy webhook)

- Existing Windows setup has n8n `2.47.6` at `http://localhost:5678`. `n8n.nishant.uk` -> *policy webhook only*, local Nginx `127.0.0.1:8787`. `mcp.nishant.uk` -> separate route to local MCP proxy on **8788**, NOT 8787 or the unrestricted editor.
- In the user-provided local diagnostic the MCP protected-resource document returned `resource=http://localhost:5678/mcp-server/http` and `authorization_servers=[http://localhost:5678]`. These **loopback URLs cannot be used by ChatGPT cloud** and explain an OAuth-discovery mismatch. They are **historical local evidence**, not proof the public hostname is currently up.
- Official n8n self-hosted deployment reference documents `N8N_MCP_BASE_URL` from version 2.31.0 as the public instance-level MCP base URL for a *dedicated MCP hostname*, separate from editor and webhook URLs. An **opt-in overlay** `infra/n8n-local/compose.mcp-url.yaml` sets it to `https://mcp.nishant.uk`. Applying it requires a reviewed local n8n container recreate, which could interrupt the active webhook. Do not change `N8N_HOST`, `N8N_EDITOR_BASE_URL`, `N8N_WEBHOOK_URL` or `N8N_PROXY_HOPS` blindly; these may affect the working policy service.
- Before applying, on the Windows machine, inspect `docker compose -f compose.yaml -f compose.proxy.yaml -f compose.mcp-url.yaml config --quiet`, `docker compose ... ps`, `Resolve-DnsName mcp.nishant.uk`, `Get-Service cloudflared`, and the public unauthenticated `/.well-known/oauth-protected-resource` and `/.well-known/oauth-authorization-server` endpoints without printing secrets. Public MCP URL should be `https://mcp.nishant.uk/mcp-server/http`. Protected-resource `resource` must advertise that exact HTTPS endpoint; OAuth authorization and token URLs must be public HTTPS too. If the resource changes but `authorization_servers` remains `http://localhost:5678`, the instance-derived OAuth base URL is still wrong and **must be fixed separately** after checking existing editor/proxy settings. Do not patch responses by hardcoding secrets or exposing the editor/API.
- Do **not** publish n8n editor, `/rest`, all workflows or sensitive private PDFs without proper authorization. MCP/OAuth routes must be deliberately scoped/rate-limited; Cloudflare Tunnel's 8788 route should not publish the entire 5678 editor. Keep 8787's strict webhook POST whitelist unchanged. ChatGPT authorization and connector creation require a separate **user-side connection action** (Settings > Apps > Create, custom MCP server URL, OAuth), and its successful OAuth handshake must be verified. The existing connected `n8n` plugin targets the old Cloud instance and cannot magically change target.
- At this checkpoint, the assistant's web connector could not fetch `mcp.nishant.uk`, and the sandbox environment could not resolve *any* public hostname (even example.org); neither observation alone proves the domain's public DNS is down. **No local Windows commands, local container restart, external DNS change, OAuth consent or ChatGPT custom-app installation were performed.** The true local MCP connection remains unverified.
- Source documentation: n8n built-in MCP client guide `https://docs.n8n.io/advanced-ai/mcp/accessing-n8n-mcp-server/`; deployment variable `https://docs.n8n.io/hosting/configuration/environment-variables/deployment/`; ChatGPT custom MCP app setup `https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt`.

### Release guard

The user initiated a **manual Vercel deployment** independently. Do not claim it is READY or that the provider flags are active solely from this report. Rollout of the duplicate-count UI is a new PR and needs latest CI and its own release. The Google-to-n8n provider cutover remains controlled by the existing feature flags and is not implied by connecting MCP.
