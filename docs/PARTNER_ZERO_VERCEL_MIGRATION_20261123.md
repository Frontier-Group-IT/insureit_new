# INSUREIT Partner App — Zero-Vercel migration

**Status: IN PROGRESS — do not publish the mixed migration branch as a production Expo OTA.**

## Contract
The installed Partner app must not require `portal.insureit.in` / Vercel for any authenticated user interaction. Keep Supabase Auth, scoped Supabase RPC, Supabase Edge Functions and private Supabase Storage. Any external RC/OCR/SMS services must be called only by secure backend functions with appropriate credentials. Avoid importing Next.js server-only code into React Native.

## Audit of reachable Partner App dependencies

| Client location | Existing Vercel route(s) | Replacement requirement | Current state |
| --- | --- | --- | --- |
| `lib/partner-session.ts` | `/api/partner/effective-permissions` | Authenticated Supabase `partner_app_effective_permissions` RPC, 37 grants, scopes, denial | **Done in PR #5131, live Expo 0.2.0** |
| `lib/account-deletion.ts` | `/api/partner/account-deletion` | Edge Function `partner-account-deletion`; idempotent requests, no client service key | **Edge deployed, app change unmerged** |
| `lib/partner-notifications.ts` | `/api/partner/push-devices` | Edge Function `partner-push-devices`; validated Expo project/token, scoped ownership | **Schema + Edge deployed, app change unmerged** |
| `lib/policy-intakes.ts` | `/api/partner/policy-intakes`, `/document`, `/bridge/issue`, web handoff | Scoped list/status, duplicates, counts, upload prepare/finish, review, OCR dispatch, bridge alternatives | **BLOCKED: needs full business-rule port + tests** |
| `lib/policy-onboarding.ts` | `/api/partner/policy-intakes/native-onboarding` plus `/sources`, `/documents`, `/policy-copy`, `/standalone-life`, `/standalone-non-motor` | Native prepare/draft/revision, motor booking, Life/Health case, nonmotor, RM/source, approvals, RC, secure signed uploads | **BLOCKED: principal cause of HTTP 402** |
| `lib/life-health-cases.ts` | `/api/partner/life-health-cases` and website edit links | Scoped list/detail/edit, case conversion, documents, stage notes, approval and audits | **BLOCKED** |
| `lib/customers.ts` | `/api/partner/customers/create` | Authenticated customer creation, dedup, scope, document staging and ID safeguards | **BLOCKED** |
| `app/partner-new.tsx` | `/api/partner/onboarding/partner-only` and `/documents` | Protected Partner creation, sensitive PAN/Aadhaar handling, reviewer scope, secure files | **BLOCKED** |
| `app/partner-documents.tsx` | `/api/partner/onboarding/documents` | Secured staged documents, signed upload, audit and ownership | **BLOCKED** |
| Various web handoff links in `lib/policy-intakes.ts` and `lib/life-health-cases.ts` | `portal.insureit.in/...` | Replace with native screens or trusted platform-independent service | **BLOCKED** |

The list above was checked against the Partner app's `lib/` files and screen-level direct `fetch` calls on `main`. Re-audit after any subsequent feature addition.

## Migration design and security gates

1. **Do not redirect an authenticated mobile call to a suspended Vercel URL.** Use Supabase Auth user JWT and server-side identity/scope verification. Every write must enforce *live* effective permission, business scope and ownership.
2. **Port operations rather than copying route names.** Preserve `apps/web-portal/lib/policy-onboarding-engine.ts`, `policy-date-approval-engine.ts`, `policy-rc-lookup-engine.ts`, duplicate verification, billing restrictions, staged-document handling, idempotency and after-commit OCR queue semantics. Migrations must have parity tests against the existing contracts.
3. **Never expose Supabase service-role keys in Expo.** Restrict Edge Functions with `verify_jwt=true`, call `auth.getUser`, compare canonical actor identity to `auth.uid()`, and keep admin mutations inside backend functions only.
4. **Preserve 403 vs 503**: actual verified denial is 403; database/service unavailability is 503. HTTP 402 from the Vercel billing gateway must not be masked as invalid credentials.
5. **Protect Storage**: issue narrow file authorizations, check MIME/length, prevent overwrites by other actors, scan/validate content, commit metadata only after upload is verified. Never send base64 15 MB documents through JSON.
6. **Preserve case/policy transaction boundaries** and reject mismatched revisions. Run duplicate-policy, customer-name/mobile collision, vehicle ownership, insurance date, financial access and signing-date regression tests before enabling mobile writes.
7. **Mobile cutover must be all-or-nothing** for each workflow. Never publish an app screen that successfully loads a draft but still depends on Vercel for its Save/Book action.
8. **OTA release gate**: all Partner direct Vercel calls removed or replaced, Supabase smoke test under real restricted identities, 401/403/409/503 cases, iOS/Android UAT, CI passed; then Expo production `0.2.0` OTA. Vercel deployment is not needed for the mobile cutover.

## Completed backend slice
- Added `supabase/functions/partner-account-deletion/index.ts`; deployed with JWT verification. The restricted deletion request queue remains in `partner_account_deletion_requests`.
- Applied the repository's preexisting `supabase/migrations/20260907002000_partner_push_devices.sql` to production (it had not previously been applied), with RLS and no `authenticated` direct table privileges.
- Added `supabase/functions/partner-push-devices/index.ts`; deployed with JWT verification and checked Expo project/version requirements.
- Mobile calls for these two services were updated in the feature branch, **not OTA published**.

## Release blockers / exact next engineering work
- Move the main 44k+ character native-onboarding route and its shared engines into an equivalent testable service, without bypassing existing booking checks.
- Move intake ingestion & OCR to a durable Supabase queue worker / n8n integration that does not rely on Next.js `after()`.
- Migrate document and customer creation, life-health cases, Partner onboarding and remaining handoff paths.
- Prove live authenticated Edge Function responses and end-to-end mobile behavior; no test user passwords should be placed in source code or logs.

**Do not declare the Partner App Vercel-independent until these blockers are closed.**
