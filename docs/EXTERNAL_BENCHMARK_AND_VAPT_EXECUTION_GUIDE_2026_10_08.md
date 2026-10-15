# INSUREIT — External benchmarks, smoke testing and VAPT next-step guide
**Prepared:** 2026-10-08 | **Status:** Evidence review and testing plan, NOT independent VAPT certification.  
**Prior durable records:** `docs/STAGE2_SECURITY_CONTINUATION_HANDOFF_2026_10_08.md` and `docs/CLOUDFLARE_SECURITY_SMOKE_HANDOVER_2026_10_08.md`. Parent issue #2980.

## Architecture and test boundaries
- Primary still-live Web: `https://portal.insureit.in` on Vercel; **automatic deployments intentionally OFF**; existing production deployment remains reachable per user.
- Alternate newer frontend: `https://insureit-new.shahdolho.workers.dev` on Cloudflare Worker `insureit-new`; user confirms GitHub auto-deploy ON.
- Both use **same production Supabase** (user-confirmed); no independent staging DB. Even Cloudflare write requests may alter real production data. No unsanctioned changes, fuzzing, destructive scan, rate/load tests, mass crawling or account creation. Separate approvals and synthetic accounts required.
- Source: GitHub `Frontier-Group-IT/insureit_new`. Latest relevant docs evidence merged PR #2993 as `b0ee1aa57ee4be058c36f1450f3c7d55ddc8f79c`; there are newer unrelated merges. Latest checked source head `71668cb529e117494c1e964cf8b5e6056a383a30`. **Do not infer tested live SHA from Git SHA.**

## Fresh user-provided third-party benchmark screenshots (8 Oct 2026)
Screenshots submitted by user for **`portal.insureit.in/dashboard`** and primary Vercel login redirect behavior; **not Cloudflare** and **not authenticated dashboard**. These screenshots are user-supplied evidence, not scans independently rerun by the assistant. Results below are read directly from screenshots and must remain scoped to the tested public/login/redirect behavior.

| Provider | Screenshot result | Important nuance |
|---|---|---|
| Mozilla HTTP Observatory | **B+ / 80 of 100**, **11/12 tests** | CSP marked unsafe, −20, including `unsafe-inline`/permissive sources. Other headers/cookie checks positive. CSP needs compatibility and security review. |
| SSL Labs (Qualys) | **A+** for 216.150.16.129; **A** for 216.150.1.129 | TLS/certificate assessment, not app authorization test. |
| SecurityHeaders.com | **A**, CSP advisory/warning | Independent browser response-header configuration score. |
| ImmuniWeb SSL | **A+** | TLS/SSL-focused, not an authenticated VAPT. |
| Lighthouse/PageSpeed **Mobile** | Performance **93**, Accessibility **100**, Best Practices **100**, SEO **100**, LCP ~**2.9 s** | Synthetic mobile public login experience. |
| Lighthouse/PageSpeed **Desktop** | Performance **100**, Accessibility **100**, Best Practices **100**, SEO **100**, LCP ~**0.5 s** | Synthetic desktop public login experience. |
| GTmetrix | Grade **A**, Performance **99%**, Structure **97%**, LCP **825 ms**, TBT **14 ms**, CLS **0.06** | GTmetrix test server in Seattle (as shown), lab results. |
| WAVE | **1 error**, **2 alerts**, **0 contrast errors**, AIM score **8.5/10**; missing/invalid language, page regions, first-level heading | Contrast sample **8.59:1**. Automated checks do not replace accessibility manual testing. |
| WebPageTest | Desktop Chrome from Los Angeles; FCP **0.654 s**, LCP **1.087 s**, TTFB **0.291 s**, CLS **0.115**, TBT **0 s**, total load **0.918 s**, **27** requests, **328 KB** | One laboratory run. Do not assert performance for India/users behind authentication. |

The user previously asked to ignore earlier tests; **this section records only the newly supplied screenshots**. Do not combine dates or silently reintroduce prior results.

## What remains incomplete
- Live Cloudflare anonymous / authenticated browser smoke **NOT verified** from this assistant runtime (HTTP inspector cache/error and execution-environment DNS; neither proves app outage).
- Multi-role customer/partner/sales/operations/accounts/IT end-to-end checks with synthetic accounts, Supabase RLS/RPC/storage/tenant isolation, upload safety and session lifecycle **NOT completed**.
- Android installed-device Customer and Partner smoke **NOT completed**; mobile package static/dynamic review **NOT completed**.
- Third-party authenticated VAPT, remediation/retest and certificate/sign-off **NOT completed**. Dependency Highs remain open; see #2980 and #2985.

## A — OWASP ZAP baseline: how to do it safely
Official: https://www.zaproxy.org/docs/docker/baseline-scan/
1. Have the owner formally approve target hostname(s), start window, crawl limits and test operator. **Use only public login/redirect scope** initially; don't scan the shared production Supabase API, administrative paths, private pages or unrelated vendor domains.
2. Install Docker Desktop on local Windows test PC. Pull official `ghcr.io/zaproxy/zaproxy:stable`. A ZAP *baseline* includes a short spider and passive assessment. **Passive alerts do not mean zero requests**—the spider still makes HTTP requests.
3. From PowerShell, in an empty local reports directory, run a strictly scoped baseline only after approval: `docker run --rm -v "${PWD}:/zap/wrk/:rw" -t ghcr.io/zaproxy/zaproxy:stable zap-baseline.py -t https://portal.insureit.in/login -m 1 -r zap-primary-public.html -J zap-primary-public.json -I`. The `-I` option treats warnings as informational for CI; it does **not** mean findings are remediated.
4. If scanning Cloudflare, use separate named report and only after checking exact deployment + same backend sensitivity. Review spider visited URLs and stop if it traverses production write routes. Avoid Active Scan, Ajax spider, forced browsing and brute force.
5. Save report, date, hostname, test configuration, URL list, ZAP version, findings (false-positive review) and redacted screen captures. Have vendor reproduce higher risk issues on a segregated test lane.
6. Do not claim ZAP baseline is full penetration testing. For shared production DB any authenticated scanner requires a written rules-of-engagement and synthetic data.

## B — Authenticated Web functional smoke: how to do it safely
1. Confirm Cloudflare Worker version and full Git commit; verify same Supabase project ID/bindings using **non-secret identifiers only**, then approve clearly named synthetic test accounts for Customer, Partner, Sales Executive, Operations, Accounts, IT/Admin. No credentials in GitHub, report, screenshots or chat.
2. Use a real browser session available to the operator, or GitHub Playwright locally with an isolated test suite. Start **read-only**: login with test account, redirect, logout, session expiry, denied routes and owner-only records. Do not mutate production objects or perform account/email/voice/SMS triggers without permission.
3. For each role, capture timestamp, tested URL, browser/device, Worker version, route, expected versus observed behavior, screenshots with names/phone/policy/vehicle masked, relevant sanitized console/network errors. Never capture access/refresh tokens.
4. After explicitly approved synthetic-data writes, cover: customer policy/vehicle, lead source, policy intake/OCR preview, claims stage changes, renewals, Accounts XLSX import/export, payout/TDS reconciliation, signed document access. Clean up only with known reversible operations and approval.
5. Negative tests must verify **server-side** authorization (e.g. cross-customer/cross-branch access denied), not merely hidden UI. Escalate suspected access-control defects privately rather than reproducing across real accounts.
6. Record each test `PASS / FAIL / BLOCKED / NOT RUN`; list test IDs CF-01..CF-10 from Cloudflare smoke handoff; owner, repro, severity, fix PR and retest. A test passed on Vercel is **not** assumed passed on Cloudflare.

## C — Mobile security/static and real-device functionality
MobSF: https://github.com/MobSF/Mobile-Security-Framework-MobSF and Docker: https://github.com/MobSF/docs/blob/master/running_mobsf_docker.md
BrowserStack App Live: https://www.browserstack.com/app-live and upload guide: https://www.browserstack.com/docs/app-live/app-source/upload-apps
OWASP MASVS: https://mas.owasp.org/MASVS/
1. Locate **existing approved signed APK/AAB files** for Customer and Partner (or already-uploaded trusted private test-service copies). Do NOT create new APK/AAB; Expo JavaScript source or OTA alone is not an Android binary. Record package ID, native versionCode/versionName, signing provenance, Expo runtime/update ID.
2. Run a **private** MobSF instance in Docker on a controlled workstation or vetted assessor infrastructure. Example from official docs: `docker pull opensecurity/mobile-security-framework-mobsf:latest`, `docker run -it --rm -p 127.0.0.1:8000:8000 opensecurity/mobile-security-framework-mobsf:latest`. Open http://127.0.0.1:8000. Change default credentials/secure local access where supported. Upload existing approved binary only; do not upload private mobile packages to public unapproved analyzers.
3. Review exported PDF/JSON findings for AndroidManifest permissions, exported components, network security, certificate validation, secrets (avoid publishing values), insecure local storage, backups, debug flags and cryptography. Confirm each finding manually and use MASVS as standard; scan results are not independent VAPT certification.
4. For BrowserStack, use **already existing approved APK/AAB** or previously uploaded app within organization's approved workspace. Upload under App Live > Uploaded Apps > Upload and choose a compatible Android device. BrowserStack accepts Android `.apk`/`.aab`, but a new binary should not be built just to run this test without separate user approval. If no binary is available, test current physically installed apps locally and record this gap; BrowserStack can't remotely import arbitrary apps from a user's phone.
5. For both apps and two or more representative Android OS/device models, run login/logout, role data isolation, home, policies/vehicles/claims, document picker/camera uploads, deep links, offline/online transition, notification permission/push, runtime crash logs, background/resume and logout storage clearing. Use synthetic accounts; capture redacted video or screenshots.
6. Treat Expo OTA as separate JS update provenance; never assert an installed device runs latest Git SHA merely because CI passed. Do not publish OTA or build binaries as part of security report preparation.

## External report and handoff format
For each independent result: tested **provider/tool version**, date/time/timezone, **exact hostname/URL or APK hash**, region/device/profile, configuration, scope, evidence URL/file, score/findings, limits and remediation state. Management summary: 1-page architecture + 1-page verified benchmark table + 1-page self-test status and explicit gaps + 1-page third-party ROE/next steps. External provider should be allowed to begin scoped assessment, **not** given a claim of full smoke/VAPT certification.
