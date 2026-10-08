# INSUREIT production assurance checkpoint — 2026-10-08

**Audit readiness: IN PROGRESS. NOT CERTIFIED.** Controlled independent penetration testing and smoke testing may begin with written rules of engagement; no claim of an issue-free website or mobile apps.

## Confirmed progress
- Reconciled Critical dependency patch PR #2964 merged to main on 2026-10-08 as `de397d4f1e6a3028b65f039782780a0c22635927`, preserving newer Customer portal changes. Next and eslint-config-next 15.5.27; root Next 15.5.27 and shell-quote 1.11.0 overrides; npm-generated lockfile.
- Node 22 exact version checking, `npm ci --ignore-scripts`, `npm ls --all` verified before merge. Standard GitHub Web #5668, Customer #1104, Partner #608 passed (full typecheck, lint, regression and production/export builds).
- Superseded PR #2959 closed unmerged. Source audit PR #2957 diverged substantially, so changes are being replayed on a new branch instead of force merging.
- Prior isolated patched candidate audits showed Web/Customer/Partner 0 Critical; a **fresh merged-commit npm audit** is still needed. No assurance that production is deployed or scanned.
- Previous detailed investigation remains at `docs/PRODUCTION_ASSURANCE_HANDOFF_2026_10_07.md` on branch `security/assurance-stage2-supply-chain-2026-10-07-v5`. Detailed Oct 8 finding ledger remains at `docs/ASSURANCE_AUDIT_CHECKPOINT_2026_10_08.md` on branch `security/assurance-audit-readiness-2026-10-08`.

## Open Stage 2 blockers
- Residual Web High advisories: XLSX 0.18.5, Sharp/PostCSS nested in Next, Tailwind 3 build chain (chokidar/fast-glob/micromatch/braces), plus patchable transitive dependencies. Do not blindly migrate Next/Tailwind major versions.
- Residual Customer/Partner High advisories in Expo SDK 54 / React Native 0.81, Metro, node-forge, xmldom and other transitive packages. Major Expo/native upgrade requires separate explicit approval and installed-device compatibility proof. **No APK/AAB builds without request.**
- XLSX 0.20.3 candidate synthetic workbook round-trip passed; app-level reconciliation export/upload/preview edge cases and tarball integrity still need verification.
- Stage 2 is incomplete until patchable advisories are addressed and residual exceptions include advisory, dependency path, actual reachability evidence, owner, controls, expiration and retest.

## Remaining sequential test classes
Dependency assurance/SBOM/provenance; SAST/secrets current and history; Supabase Auth/RLS/RPC/storage and role boundary/BOLA; API abuse, uploads, injection, XSS/CSRF and rate limits; Web functional smoke; Partner and Customer mobile smoke on existing builds/runtime; observability; performance/load/spike/soak; backup/restore/DR; third-party VAPT and independent fix retest.

Test evidence: test ID, exact commit/deployment/mobile runtime/DB version, environment, safe test data, steps, expected/actual, artifacts, defect, fix PR, retest, sign-off. No production-destructive tests or PII in evidence. Final management certification follows only once all classes have completed and findings resolved or formally accepted.

**Release guard:** merge only CI-green current branches; record deployment separately from merge. No manual production deployment, DB changes, OTA or APK/AAB without explicit authorization.


## Verified merged-baseline GitHub dependency audit (2026-10-08)
- Source: GitHub Actions dependency assurance run `37740826570`, commit `9ba64b63ed9c6487813a689c0d97af541b2f3588` based on merged Critical patch, artifact `11533563502`, SHA256 `d32be9173e053400db70185c31528d74f5260de16dbebdc07142e9e33a3d741e`.
- Results (`npm audit --workspace <name> --omit=dev`): **Web: 0 Critical / 10 High / 3 Moderate; Customer: 0 Critical / 34 High / 23 Moderate; Partner: 0 Critical / 55 High / 14 Moderate.** `npm ci --ignore-scripts` and `npm ls --all` passed in GitHub Node 22. Audit groups are package dependency findings, not independently proven exploitable vulnerabilities.
- Remaining Web Highs: `braces`, `chokidar`, `fast-glob`, `micromatch`, `nanoid`, `postcss`, `sharp`, `source-map-js`, `tailwindcss`, `xlsx`. Prior candidate transitive security overrides should be re-tested on this exact current source before any merge. No global force-upgrade or unverified native migration.
- Main Critical patch PR #2964 merge is confirmed; live Vercel deployment of the merge commit is **not confirmed** by exact-SHA query. Do not conflate merged with deployed.


## Actual merged status — 2026-10-08 after two remediation PRs
- **Critical fix** [PR #2964](https://github.com/Frontier-Group-IT/insureit_new/pull/2964) merged as `de397d4f1e6a3028b65f039782780a0c22635927`. Web #5668 / Customer #1104 / Partner #608 PASSED.
- **Assurance evidence and continuity** [PR #2965](https://github.com/Frontier-Group-IT/insureit_new/pull/2965) merged as `6ef1e46cf32191efa18124e55c246d2e39ddd8ba`. Dependency evidence #10 and Web #5669 PASSED. Stale PRs #2957 / #2959 were closed unmerged.
- **Targeted High fixes** [PR #2966](https://github.com/Frontier-Group-IT/insureit_new/pull/2966) merged as `49700da78e0bc93a181d149276ebd259bbd94c75`. Patched `nanoid` to 3.3.18 and `source-map-js` to 1.2.2, npm-generated lockfile checked on Node 22; final Web #5674 / Customer #1108 / Partner #612 PASSED. Temporary write-enabled lock repair job removed.
- **Verified current main manifest/lock versions:** Next 15.5.27, shell-quote 1.11.0, nanoid 3.3.18, source-map-js 1.2.2. These are source dependency resolutions, NOT proof of rollout to the live Vercel domain or installed Android applications.
- Most recent audited baseline **before** PR #2966: Web 0 Critical/10 High/3 Moderate; Customer 0/34/23; Partner 0/55/14. **Re-run npm audit after PR #2966** to establish revised counts; do not predict them.
- Stage 2 continues with remaining High findings: Web XLSX, Tailwind/build chain, Next nested PostCSS/Sharp, mobile Expo/React Native and upstream chains. Validate attack paths and version-compatibility. No blind Expo native/runtime upgrades or APK/AAB.
- **Live deployment/OTA/installed-device verification remains unconfirmed.** No manual Vercel production action, database changes, OTA publish or APK/AAB build was initiated by this assurance program.


## 2026-10-08 Stage 2 latest checkpoint — supersedes earlier counts

**Merged and verified by review-branch CI:**
- XLSX [PR #2971](https://github.com/Frontier-Group-IT/insureit_new/pull/2971), commit `105d74dddbfa1c85955ea32f5b28ad223073745b`: official SheetJS CE 0.20.3 tarball replacing vulnerable npm 0.18.5, lock integrity and version check, Business MIS hidden metadata/custom property synthetic round trip, Pay-In/Payout template read/write, clean Node 22 install, dependency audit, Web/Customer/Partner CI all SUCCESS. Real authenticated Accounts export→upload/preview/reconciliation negative paths remain **untested end-to-end**.
- PostCSS/Sharp [PR #2973](https://github.com/Frontier-Group-IT/insureit_new/pull/2973), commit `5e7d3306eea2a3382a03955e2225a72434e13774`: PostCSS 8.5.24 and Sharp 0.35.5 with deduplicated lock, standalone PNG transform and CSS processing, Web build and all other CI SUCCESS. Initial overrides left invalid Next nested copies, rejected; validated dedupe eliminated invalid copies.
- Node-side mobile transitives [PR #2974](https://github.com/Frontier-Group-IT/insureit_new/pull/2974), commit `31c0a9a7ef815d825d9d50897a771ed805e7d271`: undici 6.28.1, compression 1.8.2, exact npm lockfile + Node 22 validated, all Web/Customer/Partner and audit workflows SUCCESS. Source-level change only; no Expo SDK/native versions altered.
- The disposable sandbox's attempted undici/compression validation was interrupted on stop (exit 143/HTTP 410); do **not** cite it as passed. GitHub's independent Node 22 repair and final CI are the authoritative checks.

**Most recent verified audit on PR #2974 head `2fca43fc0ae0550da0441aa1a0a7e3f7094cf78d`:**
- Web: **0 Critical / 5 High / 2 Moderate**
- Customer: **0 Critical / 29 High / 23 Moderate**
- Partner: **0 Critical / 50 High / 14 Moderate**
- Audit artifact `11535467785`, SHA256 `8ebb7f653beb174b58bef127752e19793d0d35d032f72623eda838d479ecece0`.
- These are npm workspace aggregate counts, not proven exploitable weaknesses or installed Android binary scan results. Earlier counts in this handoff are historical and **not current**.

**Stage 2 not complete.** Remaining Web Highs: `braces`, `chokidar`, `fast-glob`, `micromatch`, `tailwindcss`, via Tailwind 3.4.19 dependency chain. No supported safe patch was verified on Tailwind 3; Tailwind 4 changes CSS build/design behavior, so create a separate visual-regression migration evaluation rather than blind upgrade. Direct exploitation via production request traffic has **not** been established or ruled out.

Customer/Partner residual High advisories cluster in Expo SDK 54 / RN 0.81/Metro/CLI, node-forge, related libraries and build/native dependencies. Review root causes, bundling, exact entry points and installed runtime. **Do not auto-upgrade Expo to 57 or RN to 0.87**, and do not build APK/AAB without separate user request. A formal exception record requires owner, path, GHSA/CVE, affected artifact, proof of build-only/unreachable status or exposure, mitigating control, expiration, independent pentest review and re-evaluation trigger.

**Next assurance gates:** inventory each residual High and verify runtime reachability with static bundle/native and backend entrypoint checks; evaluate Tailwind 4 separately with approved visual regression; evaluate Expo native migration separately; execute controlled authenticated Web/Customer/Partner smoke, API/authz/RLS/storage security checks, performance/load and independent VAPT/retest in sequence. No final issue-free report until completed. No destructive production test, new native build, OTA publish or manual production deployment was executed here; live rollout status not independently verified.


## Confirmed canonical live portal deployment gap — 2026-10-08 read-only check
- Vercel team `team_DsOUqnF8Pbd7YGNt8RCE8NgA`, project `insureit_new` ID `prj_OLXA2UB1LwMd0UidP8MNa1O9MLuq`; `portal.insureit.in` is a **verified** project domain (Vercel project-domain lookup).
- The latest returned READY *production* deployment for that project was `dpl_BFkWPLb8WN3tLeVPJ6icwSoebK2C`, source SHA `d3974a94899e1bc2250a00fe1a8baa498b6188e7` (Oct 7). A production list query filtering for Stage 2 Critical patch SHA `de397d4f1e6a3028b65f039782780a0c22635927` returned zero matching deployments.
- Therefore **GitHub merges are verified but live production application of these patches is NOT verified**. Do not claim the patched dependency versions currently serve `portal.insureit.in`, or that mobile installed runtimes include them.
- Before final VAPT/smoke certification, verify deployment of an approved frozen commit through the existing protected production release process (not from this audit doc PR), check the canonical domain/source SHA, test auth/session/role routing/Accounts exports and uploaded documents/claim & policy flows, review runtime errors, and establish rollback readiness.
- **No manual production deployment was triggered in this assurance turn**. Merge authorizations are not interpreted as permission to bypass the controlled production release/OTA workflow.
