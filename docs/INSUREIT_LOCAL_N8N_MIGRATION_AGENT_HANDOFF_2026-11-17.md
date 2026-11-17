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
