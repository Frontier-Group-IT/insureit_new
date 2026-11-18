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
