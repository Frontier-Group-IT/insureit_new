# INSUREIT — Cloudflare-first smoke and external VAPT handover

Date: 2026-10-08. **State: PLANNED / NOT TESTED / NOT CERTIFIED.** Parent tracker: https://github.com/Frontier-Group-IT/insureit_new/issues/2980. Stage 2 handoff: `docs/STAGE2_SECURITY_CONTINUATION_HANDOFF_2026_10_08.md`.

## Correct active deployment target
The user explicitly confirmed that Vercel automatic deployment is **intentionally turned off**. It is not a missing-release blocker and must not be restarted or promoted as part of this assurance workflow.

**Active UI environment is an alternate Cloudflare deployment connected to the same GitHub repository with auto-deploy on.** Repository `Frontier-Group-IT/insureit_new`, Web source `apps/web-portal`, Cloudflare OpenNext configuration `apps/web-portal/open-next.config.ts` and `apps/web-portal/wrangler.jsonc` (`name: insureit-new`, Worker `.open-next/worker.js`, `nodejs_compat`, observability on). Prior documentation mentions `https://insureit-new.shahdolho.workers.dev`; **URL, access, deployment SHA, auto-deploy success and account/DB bindings are NOT independently verified**. Public retrieval attempt could not establish app status. Do not mistake inability to inspect externally for an outage.

**Key security caution:** Both frontends potentially access the same backend, so even a 'staging' Cloudflare UI may write production data. Verify actual Cloudflare env bindings, Supabase project ref, secret references (names only), data classification, auth redirects and callbacks before any state-changing tests. Never print secret values or use real customer PII. Use approved synthetic identities and reversible testing.

## Freeze target and create evidence (do not deploy from assurance workflow)
- [ ] Read Cloudflare dashboard deployment history; record Worker name, deployment ID, commit SHA, branch, build timestamp, status and confirmed URL. Confirm deploy is GitHub-auto-linked and whether current main `e64c91343e198f2cb6a1b73b015c93a8ce5247ea` or newer was deployed.
- [ ] Determine if Cloudflare runs OpenNext build from `apps/web-portal`, wrangler version, environment variables **names only**, Supabase project ref and storage/auth endpoint scope. Document which environment can alter production backend.
- [ ] Check response headers, auth callback redirect, CSP, CORS, cookies, open redirects, session timeout, fail-closed access and observability. Avoid active exploitation against live sensitive backend.
- [ ] Snapshot exact SQL migration version and API/server release evidence without schema changes; agree rollback plan if a later patch is approved.
- [ ] For third-party testing freeze a **known Cloudflare deployment commit**, and disable or isolate auto deployment to a separate VAPT URL/test lane during the engagement if necessary. Do not alter the user's auto-deploy setting without authorization.
- [ ] Obtain fresh Node 22 exact SHA dependency audit on a frozen source baseline and record artifact/hash. Unresolved Tailwind/Expo Highs are not automatically exploited or accepted.
- [ ] Evaluate Cloudflare-specific differences from Vercel: Workers Node compatibility, edge API handling, upload size/timeouts, PDF/Sharp/XLSX behavior, streaming, cache, environment secrets, webhook and OAuth callback origins.

## Minimum authenticated Web smoke matrix (synthetic accounts, non-destructive first)
| ID | Role/module | Test to perform | Pass evidence |
|---|---|---|
| CF-01 | Public unauth | /login reachable, no private route/data access, no open redirects | HTTP/route behavior, sanitized traces |
| CF-02 | Customer | login/logout, session persist/expiry, Customer-only navigation; block staff/other customer records | screenshots, sanitized auth/RLS traces |
| CF-03 | Partner | login, policy register ownership, lead source, policies, fleet, claims, renewals | matched source IDs and route results |
| CF-04 | Sales Executive | sidebar only authorized sections, intake permitted, add-policy denied, owned policies only | role matrix evidence |
| CF-05 | Accounts | XLSX CE export/template import/preview, malformed workbook rejection, Pay-In/TDS/Payout reconciliation | sample synthetic workbooks + expected/actual |
| CF-06 | Operations | policy onboarding/intake/OCR, vehicle linkage, claims, claim documents, renewal | synthetic lifecycle trace |
| CF-07 | Admin/IT | security settings, role changes and least privilege, notifications/audit | audit records + denied requests |
| CF-08 | Storage | signed upload, type/size restrictions, claim/policy download ownership | sanitized test objects and status |
| CF-09 | Reliability | controlled navigation, refresh, browser back, error boundary, repeated UI interactions | console and edge logs with test ID |
| CF-10 | Cloudflare runtime | CSS/fonts/image processing, edge transforms, downloads, SSR, cache/session behavior | deploy SHA and header/error evidence |

Record Test ID, timestamp, tester, Worker deployment SHA, DB migration ref, synthetic dataset, steps, expected/actual, issue severity, evidence location, fix PR and retest. No claim of passed smoke from a GitHub build alone.

## Mobile app smoke (installed existing Customer and Partner binaries)
Record native build identifier, Expo runtime/channel + installed update ID, device/Android version, Supabase environment; test sign-in, fleet/policies/claims, upload, network offline/online, permissions, navigation, notification, and errors. **No APK/AAB build or OTA publish** without user request. Web Cloudflare CI does not verify installed Android runtime.

## External VAPT engagement rules
- Written authorization for exact Cloudflare hostnames, APIs, mobile builds, test users, test windows and infrastructure ownership.
- Explicitly forbid destructive loads/DoS, broad scanning without rate limits, live PII exports, third-party integrations without owner approval, destructive modifications or exploiting unrelated infrastructure.
- Require role-by-role authorization/BOLA, auth/session, RLS/RPC/storage, upload validation, XSS/CSRF/injection, API abuse/rate-limits, dependency risks and Cloudflare edge config assessment.
- Deliver signed finding report (CVSS/CWE/repro sanitized), accountable owners, patch PR/CI evidence, independent retest, accepted-expiring exceptions and formal sign-off.

## Current gates
- **Ready for vendor scoping and non-invasive discovery:** YES, after safe scope/ROE agreement.
- **Ready for accepted final smoke/VAPT certification:** NO. Authenticated Cloudflare E2E, Android installed-device checks, current-main audit and runtime dependency reachability, and independent VAPT sign-off are not complete.
- **Vercel paused intentionally:** informational; not an active blocker. Do not turn it on.
