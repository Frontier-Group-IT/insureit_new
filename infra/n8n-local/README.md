# INSUREIT — n8n local parallel-migration kit

This directory is a **local read-only proof of concept**. It does **not** change the live INSUREIT portal, production Supabase, Cloudflare, or the published n8n Cloud workflow.

## Snapshot and boundaries

- Source: published n8n Cloud workflow `Iu6WUQiHeGwfDol9`, version `770bd23c-c939-4dc9-8a53-17d71080b6be` (9 nodes).
- Export: `workflows/insureit-icici-3005-local-test.json`.
- All credential references were removed. The imported workflow is **inactive**.
- Local test webhook path is deliberately different: `insureit-policy-intake-icici-local-test-v1`.
- Test webhook authentication is `none` **only because Docker listens on localhost**. Before any remotely accessible deployment, configure Header Auth and restrict ingress.
- The default production portal currently accepts **only** `https://insureit.app.n8n.cloud/webhook/insureit-policy-intake-icici-v1`, so this local URL is *not* a production drop-in.
- No booking, Intake reprocessing, Supabase SQL migration, or production webhook switch is performed.

## Step 1 — Prepare on Windows with Docker Desktop

From this directory in PowerShell:

```powershell
docker version
docker compose version
Copy-Item .env.example .env
notepad .env
```

Use an exact n8n image version matching your existing Cloud editor if available (`Settings → About`), **not** `latest` for migration testing. Set both passwords independently to long random strings; generate them using a trusted password manager or PowerShell, and never paste them into ChatGPT or GitHub. Keep the `.env` file private.

Ensure Docker Desktop's Linux containers and WSL2 backend are running and that the computer has enough free disk space. This is a local development stack, not a 24/7 production endpoint.

## Step 2 — Start n8n (no production changes)

```powershell
docker compose -f compose.yaml config --quiet
docker compose -f compose.yaml pull
docker compose -f compose.yaml up -d
docker compose -f compose.yaml ps
docker compose -f compose.yaml logs n8n --tail=40
```

Open **http://localhost:5678** and create the local owner account. The only published port is `127.0.0.1:5678`; PostgreSQL is not published. Do not expose Docker's port 5678 on the internet.

If n8n exits, inspect `docker compose -f compose.yaml logs n8n --tail=100`. Do not print `.env` values or export logs with credentials.

## Step 3 — Import the snapshot, inactive

```powershell
docker compose -f compose.yaml exec n8n n8n import:workflow --input=/migration/insureit-icici-3005-local-test.json
```

Open the imported workflow and check:
1. It remains **inactive**.
2. All nine nodes and their connections are present.
3. The old `Header Auth account` reference is absent, because secrets are not exported.
4. The production workflow on n8n Cloud remains published and unchanged.

The local test copy intentionally uses no Header Auth while bound to localhost. **Do not use this configuration with a tunnel, reverse proxy, public DNS name, or port forwarding.** For an eventual externally reachable instance, first create a new `httpHeaderAuth` credential with header `x-insureit-policy-intake-secret`, change the webhook node to Header Auth, and verify it end-to-end using an independent secret. Do not reuse or disclose production secrets.

## Step 4 — Read-only parser verification

Use the workflow's bundled synthetic ICICI PDF Text node with the **Manual Synthetic Test** trigger in the local UI. Enable this test trigger only in the local copy, execute, and inspect `Return INSUREIT Review-Only JSON` for the expected ICICI 3005 checks, policy issuance date, and no booking side effects. Disable it afterward.

For a real PDF test, use a nonproduction sample PDF supplied locally and a dedicated local webhook. Do **not** send real customer PDFs through an unprotected public URL. n8n's production webhook responds only when the local workflow is activated; avoid activating until authentication and source checks have been reviewed. If testing through a manually opened editor's test webhook, use the n8n-generated test URL and don't confuse it with the production path.

This workflow parses data for review only; there are no customer/policy booking nodes.

## Step 5 — Before any production cutover (separate approval)

1. Decide on reliable hosting. A Windows PC that sleeps/offlines cannot support an always-on policy intake queue. VPS or dedicated always-on host + stable HTTPS is recommended.
2. Secure `n8n.insureit.in` or equivalent with TLS, ingress/auth restrictions, backups, monitoring and preserved encryption key. **Never set `N8N_SECURE_COOKIE=false` for a publicly reachable HTTPS service.**
3. Rebuild Header Auth; perform one signed Supabase PDF fetch (HTTP 200) and schema/financial/date verification on a nonbooking test Intake.
4. Change portal's strict origin allowlist in `apps/web-portal/lib/policy-intake-n8n-bridge.ts` to the approved hostname and update `INSUREIT_N8N_OCR_WEBHOOK_URL` at the serving backend. Change the portal deployment only after CI and separate authorization.
5. Stop/coordinate the old n8n Cloud service and all producer workers to avoid duplicate ingestion. **Do not** run Cloud and self-hosted instances simultaneously against production booking webhooks.
6. Change the local test path back to the approved production path and enable Header Auth, then perform **one read-only** production-current-PDF test before any bulk conversion.
7. Validate idempotency, per-Intake review holds, customer matching, issuer dates and older-month OTP. Any real booking requires a separately authorized confirmation.
8. Preserve the Cloud workflow for rollback until signed off. A rollback also needs a one-way endpoint switch and confirmation that only one instance accepts production requests.

## Troubleshooting & restore

```powershell
docker compose -f compose.yaml ps
docker compose -f compose.yaml logs --tail=100 n8n
docker compose -f compose.yaml stop
docker compose -f compose.yaml start
```

Data persists in the named `postgres_data` and `n8n_data` volumes. **Never run `docker compose down --volumes`** unless deliberately destroying the *local test* database. Back up both the PostgreSQL database and the encryption key before upgrading.

## Why we are not cutting over yet

The provided n8n Overview screenshot shows `Prod. executions: 1,000`, but that counter alone does **not** establish whether the subscription quota is exhausted. The active Cloud workflow saved no successful or failed production execution data. The portal previously collapsed all non-2xx webhook statuses into `n8n_bridge_http_failure`, so we cannot yet prove whether the HTTP response is 429, a quota-block message with another status, or a separate upstream outage.

PR #4769 (merged) adds sanitized status-specific diagnostics and stops bulk booking on a shared service failure, but a **production deployment and one controlled nonbooking verification** are needed before assigning a definitive HTTP cause. This kit does not suppress the quota problem; it creates a safe local migration target that can be tested without touching production.
