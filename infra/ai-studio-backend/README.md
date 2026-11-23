# AI Studio canonical backend — Windows Docker + Cloudflare Tunnel

Purpose: run the EXISTING Next.js Reparse / Convert engine independently of Vercel.
This is **not** a second booking implementation, and does not move the frontend.
The local n8n tunnel on port 8787 stays untouched.

## Preflight

1. Confirm GitHub PR CI is green and all production booking environment
   dependencies (Supabase, signed PDF URL, self-hosted n8n, issuance/OTP settings)
   are independently verified. Do not guess or copy secrets into chat.
2. On the Windows Docker machine, from the repo's
   `infra/ai-studio-backend` directory, copy `.env.example` to `.env`
   and supply the real runtime configuration locally. NEVER commit `.env`.
3. Start with `INSUREIT_AI_STUDIO_BACKEND_ENABLED=false`.
   Run `docker compose config`, then `docker compose build` and
   `docker compose up -d`. Review startup logs locally for missing configuration.
4. Run `./smoke-test.ps1` to verify the local proxy isolation, then verify `http://127.0.0.1:8790/api/partner/ai-policy-studio/actions`
   returns 405 for GET when sent with the expected Host.
   Confirm every other URL, including `/login`, `/api`, `/admin`,
   and n8n editor paths, returns 404 from the proxy.
5. Add ONE **new** published application route on the *existing*
   `insureit-n8n-windows` tunnel: hostname `studio.nishant.uk`,
   service `http://localhost:8790` (no wildcard path).
   Cloudflare must proxy HTTPS. Do not alter the existing `n8n.nishant.uk`,
   `n8n.insureit.in` or `mcp.nishant.uk` routes.
6. Run `./smoke-test.ps1 -Public` after the tunnel route is live. Public GET to the actions path must not produce a successful response;
   unauthorized POST must be rejected. Recheck non-Studio paths return 404.
7. Keep the Partner OTA action flag OFF. In a controlled testing window,
   set `INSUREIT_AI_STUDIO_BACKEND_ENABLED=true` and restart the backend
   to run authenticated negative tests (unprivileged actor, invalid JWT,
   duplicate booking, changed PDF, ownership/RTO/date/OTP cases, timeout
   and repeat request) and a pre-approved disposable eligible intake.
   Revert the backend flag to false if any acceptance test fails.
8. Only after these tests pass, leave the backend enabled and release
   a Partner OTA with
   `EXPO_PUBLIC_AI_STUDIO_API_URL=https://studio.nishant.uk` and
   `EXPO_PUBLIC_AI_STUDIO_ACTIONS_ENABLED=true`. No native app rebuild required.

## Invariants

- Nginx exposes only the single POST action path.
- Every action independently checks the Supabase JWT and IT-only intake scope.
- No browser cookies, arbitrary draft fields, or service-role secrets are accepted.
- The existing Next.js canonical engine performs final policy registration.
- Unknown conversion outcomes require checking the intake before retry.
- Nothing here automatically deploys or switches production traffic.

## Rollback

Disable the Partner action OTA feature flag, set
`INSUREIT_AI_STUDIO_BACKEND_ENABLED=false` and restart the backend.
Remove only the new `studio.nishant.uk` tunnel route if needed.
Do not modify n8n webhook routes or production policy data.
