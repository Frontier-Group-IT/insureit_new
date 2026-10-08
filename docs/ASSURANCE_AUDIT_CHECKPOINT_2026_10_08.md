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
