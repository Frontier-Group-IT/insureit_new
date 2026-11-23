# Partner AI Studio — canonical actions on alternate Cloudflare OpenNext backend

Date: 2026-11-23
Status: Branch + CI; disabled in published Partner application until the dedicated Windows backend is verified.

## Preserve the canonical booking engine

This approach reuses:
- `reparseAndReplaceAiPolicyIntakeDraft` for current-PDF n8n re-verification and complete OCR-derived draft replacement;
- `convertVerifiedAiIntake` for strict insurer, customer, vehicle, duplicate, coverage, premium, issuance-date and audited policy registration checks;
- `onboardPolicyForVerifiedActor` and the existing atomic database finalization transaction.

It does NOT duplicate financial, issuance or policy booking logic in the Partner app or directly call the policy-save RPC with handset-supplied fields.

## Architecture

Partner app (Expo runtime 0.2.0) → authenticated, explicit confirmed action
→ HTTPS `studio.nishant.uk` (Cloudflare Tunnel → localhost:8790 Nginx path-only proxy)
→ Windows Docker Next.js Node runtime `POST /api/partner/ai-policy-studio/actions`
→ Supabase JWT `getUser` + IT-only `partner_app_ai_studio_detail_v1` permission
→ request-scoped token via AsyncLocalStorage
→ *existing canonical server action* → n8n/PDF/transaction.

No global impersonation; for ordinary website requests the original cookie auth is unchanged. A browser session cookie cannot override the already verified scoped bearer token. The app only transmits intake UUID, action kind and explicit confirmation. No policy field payload, service-role token, PDF bytes or n8n secret is accepted from the client.

## Enablement prerequisites

1. Use the dedicated `infra/ai-studio-backend` Windows Docker Compose setup; do NOT create or replace a frontend Cloudflare Worker. Publish a separate `studio.nishant.uk` hostname on the existing Cloudflare Tunnel to `http://localhost:8790`. Leave all existing n8n and MCP routes untouched. `portal.insureit.in` on Vercel must NOT be used as a fallback.
2. Verify the Windows Docker Next 15 runtime supports canonical server actions, Node AsyncLocalStorage, Supabase client and secure PDF access. The proxy must return 404 for all paths except the exact Studio actions endpoint; verify unexpected hosts/HTTP methods are denied.
3. Confirm the production backend environment equivalents are set on the local Windows Docker host (never in GitHub source or app): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `INSUREIT_N8N_WORKBENCH_PRIMARY`, `INSUREIT_N8N_OCR_MODE`, `INSUREIT_N8N_OCR_WEBHOOK_URL`, `INSUREIT_N8N_OCR_HEADER_SECRET`, queue flags, and relevant issuance/OTP/date integrations, with values held only in account secrets. Verify `n8n.nishant.uk` is reachable and header auth passes without exposing URLs or customer data.
4. Set `EXPO_PUBLIC_AI_STUDIO_API_URL=https://studio.nishant.uk` and `EXPO_PUBLIC_AI_STUDIO_ACTIONS_ENABLED=true` in the *production OTA pipeline* only after QA.
5. Test IT vs non-IT callers, tampered JWT, wrong intake, stale/missing PDF, reparse against changed version, duplicate number, identical/ambiguous customer, registered ownership conflict, negative insurer checks, positive CPA, unusual RTO, OTP earlier-month issuance, concurrent clicks, network timeout and repeat booking, no CORS/cookie bypass.
6. Require approved production OTA 0.2.0 only after backend verified; do not create APK/AAB/IPA.

## Mobile controls

Only when the feature flag is enabled and record unbooked:
- **Reparse** — prompts once, replaces OCR-generated draft (never books).
- **Verify & Convert** — prompts once, runs the same canonical server booking engine and returns policy code on successful transaction.
- Unknown outcomes block automatic retry until user refreshes and checks the actual policy.

Both are hidden by default. No writes are live in the Partner OTA published in PR #5141.

## Rollback

Unset action env flags and publish Partner OTA; never directly edit policies or bypass duplicate/ownership protections. Disable `INSUREIT_AI_STUDIO_BACKEND_ENABLED` and the Partner OTA flag; remove only the new tunnel route if needed. No use of paused Vercel production.

## Windows deployment details

See `infra/ai-studio-backend/README.md`, `compose.yaml`, `Dockerfile` and `studio-proxy.conf`. The backend route is **disabled by default** via `INSUREIT_AI_STUDIO_BACKEND_ENABLED=false`, and independently requires the `studio.nishant.uk` Host header, bearer JWT and per-intake IT-only permission RPC. No frontend website route is published by the proxy. The shared Cloudflare Tunnel remains the transport only, not a Cloudflare frontend or Worker runtime.
