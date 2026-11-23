# Partner AI Studio — Vercel-independent verification service

## Included
- Authenticated Supabase Edge Function `partner-ai-studio-verify`, with existing IT-only Supabase RPC as per-intake authorization gate.
- It reads the currently linked private Motor PDF, creates a 120-second scoped signed URL, sends it only to the allowlisted self-hosted n8n HTTPS webhook, validates the exact response identity, check booleans and fields, and rechecks document identity.
- No PDF bytes or storage tokens returned to app. No database changes or booking.
- Partner SDK verifier helper calls this Edge function with Supabase auth.

## Configuration and controls
The deployment requires Supabase Edge secrets:
`INSUREIT_N8N_OCR_WEBHOOK_URL=https://n8n.nishant.uk/webhook/insureit-policy-intake-icici-v1`
and `INSUREIT_N8N_OCR_HEADER_SECRET` (32+ chars; exact n8n Header Auth shared secret).

Never commit secret values or allow client-provided URLs. Edge function requires valid JWT and calls `partner_app_ai_studio_detail_v1` to authorize an IT Super User/Super Admin employee and the intake. Verify token issuance and endpoint availability in a signed, controlled call before enabling UI action.

## Not yet operational
This endpoint is deliberately **read-only**. A safe, fully functional one-click `Reparse & Replace` / `Verify & Convert` still needs the existing Next.js canonical intake handoff and `policy-onboarding-engine.ts` migrated or served by a validated Cloudflare OpenNext backend with proper bearer authorization and all transaction checks. Do NOT implement on-device direct booking or call database save RPC without the canonical engine. Do not present successful PDF extraction as a booked policy.

## Release
Feature branch and PR only. No standalone UI action or OTA until secret configuration and authenticated negative/positive tests. Do not disturb already published Partner runtime 0.2.0.
