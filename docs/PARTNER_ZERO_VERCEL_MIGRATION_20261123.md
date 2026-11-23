## Additional high-impact cutovers and CI audit
- `lib/partner-permissions.ts` previously called Vercel `/api/partner/effective-permissions` on **every privileged write**, despite login being migrated. It now rechecks `partner_app_effective_permissions` through Supabase, validates the permission map and fails closed if unavailable; this removes the suspended Vercel blocker from claims, customers and intake *permission checks*, but not the underlying remaining Vercel APIs.
- `components/ui/partner-insurer-logo.tsx` now loads managed insurer logos from authenticated `insurance_companies.logo_path` and public Supabase `insurer-assets` Storage, with a bundled offline-logo fallback. No Vercel insurer-logo proxy.
- Partner CI now runs `node apps/partner-app/scripts/audit-vercel-dependencies.mjs` (informational until full cutover); first result was **46 string-level references in 10 files** before the write-permission guard and insurer-logo removals.
- Web CI has a read-only anonymous Cloudflare route-presence probe. This is discovery only, no secrets, no production traffic routing or certification; the Cloudflare Worker remains unverified until successful recorded responses.
- No Expo OTA or merge before the remaining authenticated Policy Intake, booking, Life/Health and Partner onboarding flow is independently verified. A successful login or any one Edge deployment is not proof of Vercel independence.

## Additional migrated services (2026-11-23)
- `partner-policy-copy` v1: JWT-protected Motor creator-only copy attachment, one-time signed upload and verified stored MIME/size.
- `partner-onboarding-documents` v2: scoped Life/Health/Non Motor signed upload, verified finalization, replacement and removal. Client uses Supabase Storage, not Vercel.
- `partner-customer-create` v1: idempotent source-scoped customer creation, PAN/GST validation, customer-scoped private PDF/JPG/PNG KYC staging and verified file signature. Mobile customer creation/upload moved to Edge in draft PR; no production customer writes tested.
- `partner-intake-sources` v1: authenticated source dropdown with exact branch parent Partner exception and active intermediary scope. Mobile source list moved to Edge in draft PR.
- All four JWT-protected functions deployed and operational status confirmed in Supabase control plane; **not device-UAT-confirmed**.

## Remaining Vercel dependencies blocking production cutover
- Full `/api/partner/policy-intakes` GET and POST route (read list/detail/status, OCR classification, upload preparation/finalization, replacements and review_status), plus scoped policy copy signed read and website handoff.
- `/api/partner/policy-intakes/native-onboarding`: Motor booking conflict checks, date approvals, Authbridge RC lookup, standalone new-book and Life/Health case transactions; new preparatory Edge actions do not replace these.
- Life/Health case read/edit/issue, Add Partner onboarding and document staging, remaining external workflows and website links.
- Email OTP vendor secrets and RC provider credentials must be configured in Supabase Functions; they cannot be inferred or moved from suspended Vercel without authorization and secret inventory.
- Cloudflare OpenNext route exists in repo, but current live Worker and deployed SHA have not been verified, so it is **not** a safe automatic fallback.
- Run `node apps/partner-app/scripts/audit-vercel-dependencies.mjs --enforce` only when all route replacements are complete. The audit must return no dependency hits, and role-based iOS/Android UAT must pass, before Expo production OTA.

## Supabase document upload/replace/delete migration
- New `partner-policy-copy` Edge Function v1 deployed with JWT verification; employee creator-only standalone Motor policy copy (15 MB), private Storage one-time signed uploads, file-size/MIME check before metadata linking, and retry-safe finalization. Expo client uses `supabase.functions.invoke` and `uploadToSignedUrl`.
- Upgraded `partner-onboarding-documents` Edge Function to v2 with JWT verification for Life, Health and Non Motor; supports assigned-reviewer `list`, `prepare_upload`, `finalize_upload`, and `delete`. Restricts filenames and MIME, preserves existing 4 MB cap and saved business line, verifies stored file properties, replaces metadata before deleting old Storage object, and keeps private bucket paths out of list responses. Expo client uses Edge and signed Storage, not Vercel.
- Both mobile client changes are **in draft PR only**. They are not in the installed production app, and no real user file upload or booking UAT has been performed. Document services do not independently make the app Vercel-free; all other endpoints listed in this audit remain release blockers.

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
| `lib/policy-onboarding.ts` | `/api/partner/policy-intakes/native-onboarding` plus `/sources`, `/documents`, `/policy-copy`, `/standalone-life`, `/standalone-non-motor` | Native prepare/draft/revision, motor booking, Life/Health case, nonmotor, RM/source, approvals, RC, secure signed uploads | **PARTIAL: `new_prepare`, restricted `customer_search`, revision-guarded `save`, and assigned-reviewer OCR-backed `prepare` in Supabase Edge; Book/RC/approval/files and takeover-based preparation remain blocked. Principal cause of HTTP 402** |
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
- Deployed `partner-policy-onboarding` Edge Function with authenticated read-only `new_prepare` and reviewer-assigned `customer_search`; current Life Head downline search explicitly rejects 501. Booking/approval/RC operations reject with 501; **mobile is not switched to it** until booking/document operations have parity.
- Implemented `prepare` for already-assigned `in_review` intakes, using verbatim copies of the Operations OCR mapping and vehicle registration-year fallback. It enforces duplicate protection, role checks, source identity and redacted commercial fields. It does not claim an unassigned intake or allow takeover and is not yet used by the mobile app.\n- Implemented `save` for assigned intake reviewers only: exact shared draft field allowlist, optional fields, restricted financial fields, product-specific commercial validation, duplicate protection, revision CAS and fail-closed Life Operations downline scope. The final save uses `partner_app_save_intake_draft_atomic` (service-role-only, reviewer/status row locked in Postgres). **Deployed to Supabase Edge v4; not connected to the mobile UI**. No policy booking is possible through this Edge Function.\n- Deployed `partner-policy-sources` Edge Function with authenticated source search, active POSP/MISP/Partner filter, paginated results, verified assigned-intake binding and active sales RM metadata. Life Head downline search remains disabled until equivalent scope is implemented; **mobile is not switched**.
- Added `node apps/partner-app/scripts/audit-vercel-dependencies.mjs` for the remaining call inventory; `--enforce` is the mandatory final release gate, not currently green.

## Verification added
- `apps/partner-app/scripts/verify-supabase-edge-migration.mjs` is invoked by Phase 6 CI. It asserts user JWT verification, role checks, assigned reviewer filters, preserved duplicate protection, scoped source directory, no client Vercel dependency for the two completed services and explicit fail-closed unsupported actions.
- Live Supabase function presence and `verify_jwt=true` confirmed, but a test authenticated user session is still necessary for full e2e behavioral equivalence. No production customer or policy write test has been performed.

## Onboarding document read cutover
- New Supabase JWT-protected `partner-onboarding-documents` Edge Function v1 (read-only list). It requires active verified employee identity and live review/finalization grants; intake must be in review and assigned to caller, and saved draft businessLine must match Life / Health / Non Motor. Life Operations downline remains fail-closed with 501 until equivalent scope is migrated.
- Only document metadata `{type,fileName}` is returned; no storage paths, signed URLs, or modification operations. Mobile remains unchanged. Upload, signed URLs, deletes and replacement updates are separate outstanding transactions.
- CI checks the document scope guards and verifies no upload/delete methods are present.

## Latest draft-save verification
- Applied migration `20261123090812_partner_intake_draft_save_atomic.sql` (function `partner_app_save_intake_draft_atomic`) to live Supabase. `anon`/`authenticated` EXECUTE revoked; `service_role` only; `SECURITY INVOKER`.
- Harmless service-role invalid-input SQL call returned `{ok:false,status:400}`; no intake or policy writes were executed.
- Repaired commercial numeric regex matching to accept decimal digits rather than escaped backslash characters.
- Deployed Supabase `partner-policy-onboarding` Edge Function v5 with this atomic save implementation. Partner CI passed for the implementation commit; physical-device and authorized-user draft save UAT remain outstanding.

## Release blockers / exact next engineering work
- Move the main 44k+ character native-onboarding route and its shared engines into an equivalent testable service, without bypassing existing booking checks.
- Move intake ingestion & OCR to a durable Supabase queue worker / n8n integration that does not rely on Next.js `after()`.
- Migrate document and customer creation, life-health cases, Partner onboarding and remaining handoff paths.
- Prove live authenticated Edge Function responses and end-to-end mobile behavior; no test user passwords should be placed in source code or logs.

**Do not declare the Partner App Vercel-independent until these blockers are closed.**


## Policy Intake PDF service — staged read-only slice (2026-11-23)
- Added `supabase/functions/partner-intake-document/index.ts`: verified JWT, canonical identity/scope, employee effective-permission and active-profile checks; exact submitter ownership and explicit assigned in-review employee reviewer access; five-minute private Storage signed URL.
- The assigned-reviewer path requires current `review_policy_intakes` edit/approve or `finalize_policy_intakes` approve permission, exact reviewer profile ID, and `status=in_review`. Other employees and intermediary users remain submitter-scoped.
- Intermediary reads now also permit canonical, server-verified lead-source IDs: ordinary intermediary accounts use their own ID, while branch/group accounts use `partner_app_commercial_scope.intermediary_ids`, with UUID validation. Missing lead source does not prevent an otherwise authorized submitter reading their own PDF.
- Organization-wide employee PDF access is now modeled for active `super_admin` and non-hierarchy reviewers with live `review_policy_intakes` edit/approve capability. RM hierarchy roles and Life Operations Heads are explicitly excluded from organization-wide access; their exact downline predicates remain a separate migration milestone.
- This version **does not support** the complete Operations employee RM hierarchy and Life Operations Head downline. A legitimate user outside the supported paths may therefore receive 404. It must not replace the existing Partner App document call yet.
- The new service is **committed only**, not deployed or connected to the mobile UI; no PDF records or production data were modified.
- Added static security-contract assertions to `verify-supabase-edge-migration.mjs`; production release and OTA remain blocked until complete read-scope parity and authenticated role-specific tests.


## Staged active reporting-chain PDF reads
- The Policy Intake PDF Edge service now resolves active employee descendants and active profile IDs for `sales_manager`, `asm`, `zonal_head`, `sales_head`, `manager` and `director` via a bounded, fail-closed hierarchy traversal. This implements only the verified submitter portion of `reportingChainScope`, not the full RM/Partner scope.
- The `relationship_manager` role is intentionally excluded from this new path because the canonical Operations `getEmployeeAccessScope` supports capability-specific scope overrides. Partner/Branch family attribution and Life Operations Head downline remain unmet.
- Pure resolver unit tests cover active descendants, isolation from unrelated staff, stale employee edges, reporting cycles and malformed IDs. CI invokes the tests with Node type stripping.
- No user data, booking, production database, Edge deployment, OTA, or mobile call path was changed. This PR must remain draft pending full permission parity and user-account UAT.
