# INSUREIT local n8n replacement — controlled cutover

**No automatic production switch.** The current local workflow can extract a real ICICI Lombard 3005 PDF with all 13 checks, but the hosted portal cannot reach `localhost:5678` over the Internet. The existing n8n Cloud URL remains the default until the following gates pass.

## 1. Local security before exposing anything

- Keep Docker n8n on `127.0.0.1:5678` and PostgreSQL private.
- The previously displayed local PostgreSQL and n8n encryption secrets have been exposed. Generate replacement secrets privately. **Do not simply change the existing n8n encryption key in a running instance**: back up exported workflows/credentials and plan an intentional local-only rebuild or a supported rotation procedure first.
- In local n8n: create a new **Header Auth** credential, name `x-insureit-policy-intake-secret`, value a NEW random 32+ character secret generated locally. Do not reuse the old Cloud secret.
- Edit the local webhook node: `POST`, path `insureit-policy-intake-icici-v1`, authentication `Header Auth`, credential your new credential, respond `When Last Node Finishes`, response data `First Entry JSON`.
- Disable the synthetic trigger. Review workflow code and compare with the previously tested local copy. No booking nodes may be added.
- Secure the owner account. Do not expose the n8n editor/admin/API publicly. Use a tunnel route that permits **only** the webhook path. Verify an unauthenticated request is rejected, and a request to the public hostname root is blocked before activating production intake.

## 2. Create a Cloudflare Tunnel from the Windows PC

Use the Cloudflare dashboard account that manages **insureit.in**:

1. **Networking → Tunnels → Create tunnel**, connector `cloudflared`; name it `insureit-n8n-windows`.
2. Install `cloudflared` *on the Windows host* with the command shown by Cloudflare. Because the connector runs on the same Windows host as the loopback-bound Docker n8n service, the private service URL is `http://localhost:5678`.
3. Create **one published application route** for `n8n.nishant.uk`, scoped to the path `/webhook/insureit-policy-intake-icici-v1`; use the local service URL `http://localhost:5678`. If the dashboard cannot reliably restrict the route to exactly this path, **do not proceed** until a path-restricting reverse proxy or edge WAF rule is installed and verified.
4. Check tunnel health and public HTTPS. A request to `https://n8n.nishant.uk/` or `https://n8n.nishant.uk/rest/settings` **must not expose the editor/API**. Only the authorized webhook path is allowed; the webhook's Header Auth rejects missing/wrong secrets.
5. No port forwarding or public Docker port 5678. Ensure the Windows PC remains on, Docker Desktop remains running and the `cloudflared` connector starts automatically after reboot.

Reference: https://developers.cloudflare.com/tunnel/get-started/ and https://developers.cloudflare.com/tunnel/features/locally-managed-tunnels/configuration-file/

## 3. Ensure n8n shows the correct public URL

Behind the HTTPS tunnel, set `WEBHOOK_URL=https://n8n.nishant.uk/` on the n8n service and `N8N_PROXY_HOPS=1` when there is one trusted reverse-proxy hop, validating this on the running setup. Keep the editor accessible **locally only**, e.g. `N8N_EDITOR_BASE_URL=http://localhost:5678/`, and don't expose the editor hostname. Depending on the n8n release, serving the editor over local HTTP may require the existing local `N8N_SECURE_COOKIE=false`; do not expose that local editor publicly.

Do not edit the existing `N8N_ENCRYPTION_KEY` without a safe key-rotation plan. Apply config to the private Docker Compose file and restart only the local n8n service while preserving PostgreSQL and named volumes.

Reference: https://github.com/n8n-io/n8n-docs/blob/main/docs/deploy/host-n8n/configure-n8n/basic-configuration/configuration-examples/configure-webhook-urls-with-reverse-proxy.md

## 4. Validate public webhook in read-only mode

First verify with a test PDF and throwaway UUIDs. Do not create or modify any production Intake or policy. The public route must be `https://n8n.nishant.uk/webhook/insureit-policy-intake-icici-v1` (not `/webhook-test/`). The local n8n workflow must be published **only after** Header Auth, ingress restriction, rate/concurrency limits and logging are confirmed.

Expected: HTTP 200, `contract_version=1`, `ok=true`, issuance date `2026-11-15`, all 13 financial/identity checks true, no warnings, `auto_finalize_allowed=false`. Check a missing/wrong Header Auth header fails and an unrelated path is blocked. The same must work with a real *short-lived Supabase signed PDF URL* on the private n8n downloader path, not only multipart upload.

Avoid printing or saving signed URLs, auth headers or full customer PDF contents in logs/screenshots.

## 5. Controlled portal switch (separate release action)

After verification, deploy the reviewed portal code with these server-side environment variables:

```
INSUREIT_N8N_OCR_ENDPOINT_MODE=self_hosted
INSUREIT_N8N_OCR_WEBHOOK_URL=https://n8n.nishant.uk/webhook/insureit-policy-intake-icici-v1
INSUREIT_N8N_OCR_HEADER_SECRET=<new secret matching local Header Auth>
```

The code strictly accepts the pinned HTTPS `n8n.nishant.uk` destination when `self_hosted` is selected, or n8n Cloud when omitted. Updating a `.env` on the local Windows PC alone does not modify the deployed portal.

For rollback, restore the old Cloud webhook URL and secret, and set mode to `cloud` (or remove mode). Deploy the restored server-side configuration through the approved manual release workflow, after confirming the Cloud workflow is still available.

**Cutover rules:** Only one production webhook destination is active at a time. Pause coordinated queue/bulk processing before switching. Verify one read-only production-current-PDF extraction from the portal after cutover, then explicitly resume bounded queues. Do not automatically clear the previously held `bulk_conversion_review_required` Intakes, and do not resume bulk booking until the source/identity checks pass.

## 6. Reliability / rollback gate

A Windows desktop is a single-point-of-failure. Configure Windows power settings to prevent sleep, Docker restart policies, `cloudflared` auto-start, health alerts and encrypted database/volume backups. Test planned reboot, network outage and tunnel restoration. For unattended INSUREIT policy processing, an always-on VPS or dedicated host is preferable.

**Current status:** Portal code to permit the self-hosted origin is in a PR. Cloudflare tunnel, DNS, credentials, key rotation, signed-PDF HTTPS validation, and portal production environment switch are NOT yet performed.
