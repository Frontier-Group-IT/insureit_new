# Native Partner AI Onboarding Studio — 2026-11-23

## Latest installed app / history reviewed
- Separate Expo app at `apps/partner-app`, runtime `0.2.0` for Android and iOS. No native dependencies changed.
- PR #5131 moved Partner login to `partner_app_effective_permissions` in Supabase, removing the Vercel login dependency. PR #5132 delivered that change to production OTA.
- PRs #5133, #5127, #5113 updated native Stories; PRs #5120, #5119, #5117 recently refined Policy Detail, Claims and Policies. This Studio does not modify those screens.

## Mobile UX
More → **AI Onboarding Studio** → native full screen, with:
- One primary dark metric surface showing awaiting-review, running and completed totals.
- Three small status tabs; compact rows with source, checks and status; pull-to-refresh and minimal pagination.
- Tapping a row opens a clean detail sheet with the actual verified OCR fields and one precise diagnostic.
- No huge website dialog, duplicated CTA buttons, or browser WebView.

## Authorization and Vercel independence
- IT Super User/Super Admin **employee** only, requiring effective `manage_system:approve`, `view_policy_intakes:view+` and `review_policy_intakes:edit+`.
- Direct Supabase JWT RPCs for queue list and detail. Each function verifies the identity and effective permissions again on the server.
- No direct raw table reads, service-role key, signed storage URLs, n8n credentials or raw policy PDFs on device.
- Partner/POSP/MISP and other employees cannot access the route, menu, or RPC.

## Release / dependency contract
- Database migration: `20261123154000_partner_native_ai_studio_read_rpc.sql` must be applied before Partner OTA.
- No new APK/AAB/IPA or native config change.
- Phase 1 provides **real read-only queue and extracted-details visibility**, including status/errors.
- One-click Reprocess/Convert is **not** exposed: current verified PDF reparse and canonical booking logic is still Next.js server-only and cannot be copied to untrusted mobile clients. A subsequent protected Supabase Edge Function/worker implementation must migrate/reuse that existing security and transactional booking contract with end-to-end authorization, duplicate and ownership tests before action buttons are added.
- Do not claim Vercel-independent policy registration or publish to live devices without backend and release verification.
