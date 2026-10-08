# INSUREIT Production Assurance — third-party readiness checkpoint
Date: 2026-10-08

**Evidence status: NOT CERTIFIED.** Controlled smoke testing and initial independent VAPT may start, but there is no verified zero-finding conclusion or release sign-off. This checkpoint is a working audit ledger, not the final management report.

## Evidence already collected
- Isolated sandbox candidate: Next 15.5.27, SheetJS CE 0.20.3 official package, and compatibility-selected transitive dependency patches.
- Sandbox tests: clean `npm ci --ignore-scripts --no-audit --no-fund`, `npm ls --all`, Web TypeScript typecheck passed. Note that `--ignore-scripts` is not a complete runtime/build validation.
- Candidate `npm audit --omit=dev` package counts: Web 0 Critical / 8 High; Customer 0 Critical / 61 High; Partner 0 Critical / 53 High. Findings include transitive and tooling dependencies and do not by themselves prove external exploitability. These numbers are **not** a current-production scan.
- SheetJS synthetic Accounts reconciliation workbook round-trip preserved hidden metadata sheet, custom properties and editable cells. Full application export/import/preview and negative paths are not yet verified.
- Next 15.5.27 continues to include nested PostCSS 8.4.31 and Sharp 0.34.5. Both require advisory-specific assessment; do not silently suppress.
- Web and mobile CI workflows currently run extensive static/regression checks, use Node 22 on GitHub, and install with `npm install`. No native APK/AAB required to exercise the existing Expo web review jobs.

## Unresolved / sequential closure gates
1. **Stage 2 dependency assurance OPEN.** Generate and commit exact lockfile from current-main source via trusted npm tool, ensure CDN tarball integrity/provenance, run clean `npm ci` on Node 22, full dependency tree, audit/SBOM, all CI regressions, lint, typecheck and build.
2. Resolve High findings with supported, compatible fixes, or document each exception with package path, source/advisory, attack-surface evidence, owner, compensating controls and expiry. Avoid blind Expo SDK/native runtime changes.
3. Web smoke (controlled nonproduction accounts): auth/roles/session, policy intake, Accounts XLSX reconciliation, renewals, claims, uploads, reports, notifications and protected routes; record IDs, expected/actual, test data, artifacts, fix/retest.
4. Customer/Partner mobile smoke: install/runtime and OTA compatibility; login, account switching, fleet/policies/claims, network/commercial screens, upload/resume/offline/session edge cases; test on already available devices/builds **without creating APK/AAB**.
5. Security testing sequentially: secret scan and SAST, API/authz/BOLA, Supabase RLS/RPC/storage/privilege, file-upload abuse, XSS/CSRF/injection, rate limits, mobile static/runtime, DAST, load/spike/soak, backups/restore/DR, observability and independent retest.
6. External audit pack: freeze exact web commit/deployment, app runtime/OTA, DB migration; define staging targets, least-privilege role matrix and test accounts, non-PII fixtures, IP/window/traffic limits, exclusions, contacts and incident pause procedure.
7. Final sign-off requires evidence for each completed class and independent VAPT/retest, with all findings fixed or formally accepted. Never claim issue-free without that proof.

## Branch and authorization safeguards
- Current successor branch: `security/assurance-audit-readiness-2026-10-08`, based on main.
- Previous detailed assurance investigation: `security/assurance-stage2-supply-chain-2026-10-07-v5` at `docs/PRODUCTION_ASSURANCE_HANDOFF_2026_10_07.md`. The old branch is diverged and must not be merged directly.
- **No merge, production deployment, production DB mutation, OTA publication or APK/AAB build authorized.** No destructive production pentest or live customer PII.
- Distinguish sandbox/candidate results from merged, deployed and independently verified states.


## GitHub CI checkpoint — 2026-10-08 (verified)
- Draft PR [#2957](https://github.com/Frontier-Group-IT/insureit_new/pull/2957) is OPEN and unmerged; candidate SHA `d55cd26ab98d8a164037364d9d0f6ea28dbcc7c2`.
- GitHub **INSUREIT dependency assurance evidence #1**, run `37733095344`, completed SUCCESS. Its Node 22 job passed `npm ci --ignore-scripts --no-audit --no-fund`, `npm ls --all`, and production dependency audit artifact generation for all three workspaces. This checks the current committed baseline, not the experimental patched candidate.
- GitHub **Verify web portal #5634**, run `37733095110`, completed SUCCESS on the same SHA.
- Audit artifact `dependency-assurance-160f865d6a00e7e484688cb3972e4cf3de848f73`, ID `11531035071`, retained until 2026-10-22; checksum `sha256:14d424758146191475351458ca2700a10e36b814c211911ac3fe822cbc5839fc`.
- **Evidence limitation:** artifact contents/advisory counts not independently extracted in this checkpoint; success of the collection workflow is not a zero-vulnerability assertion. Existing security findings remain OPEN.
- Existing CI uses `npm install` in the main app verification jobs. The separate assurance workflow now proves `npm ci` works without changing those jobs. Later migration of core jobs to `npm ci` requires independent regression.
- No merge, deploy, production database action, OTA, APK/AAB or destructive test performed.


## Raw audit artifact reviewed — current committed baseline, 2026-10-08
**Source:** GitHub Actions run 37733095344, artifact 11531035071, three `npm audit --omit=dev --json` workspace reports. These results supersede any inference that the current production/main lock is Critical-free:

| Workspace | Critical | High | Moderate | Total | Critical package |
| --- | ---: | ---: | ---: | ---: | --- |
| Web portal | 1 | 12 | 2 | 15 | `next` |
| Customer app | 1 | 37 | 20 | 58 | `shell-quote` |
| Partner app | 1 | 58 | 11 | 70 | `shell-quote` |

Web High package names: `brace-expansion`, `braces`, `chokidar`, `fast-glob`, `js-yaml`, `micromatch`, `nanoid`, `postcss`, `sharp`, `source-map-js`, `tailwindcss`, `xlsx`.

**Interpretation:** the earlier 0-Critical candidate was an *unmerged isolated experiment*, not the current GitHub baseline. Audit workspace package counts fluctuate with lockfile resolution, advisory metadata and command context. They indicate review priority, not established exploitability. Production runtime reachability and exposure remain unverified. **Stage 2 remains OPEN and blocks a zero-issue certification.** No dependency package changes were made by PR #2957.


## Critical dependency patch work — 2026-10-08
- Created a **separate**, current-main-based reversible branch `security/assurance-critical-dependencies-2026-10-08` and draft [PR #2959](https://github.com/Frontier-Group-IT/insureit_new/pull/2959), head `861a844d5d347491673b70fd194343855eee11da`.
- Changed only manifests: Web `next` and `eslint-config-next` 15.5.21 → 15.5.27; root `overrides.shell-quote` pinned to 1.11.0. Official Next September 30 security release prescribes 15.5.27; shell-quote CVE-2026-102422 fixed at 1.11.0.
- **NOT YET COMPLETE:** exact `package-lock.json` still needs npm regeneration and commit, followed by clean `npm ci`, full CI and fresh per-workspace audit evidence. Existing Web / Customer / Partner PR checks started (run IDs 37734557291, 37734557237, 37734557837) but no conclusions recorded here.
- The audit checkpoint PR #2957 and remediation PR #2959 are separate and both remain unmerged. No runtime/production remediation claimed, and no APK/AAB/OTA/deployment.


## Critical patch CI and generated-lock evidence — 2026-10-08
- Draft PR #2959 manifests applied; GitHub Web #5646, Customer #1091, Partner #596 concluded FAILURE because the committed lockfile was not synchronized. This is a deliberate dependency integrity gate, **not** evidence that application code failed typecheck/build.
- Customer job successfully generated repair artifact `generated-package-lock-dd6d9aa76b3f86ef2486b68dd66adb325a744165` (ID `11531426082`, 3-day retention). ZIP contained `package-lock.json` (732,971 bytes). Artifact records `node_modules/shell-quote@1.11.0` and workspace-local `apps/web-portal/node_modules/next@15.5.27`, but also root `node_modules/next@15.5.21` — **old Next copy retained**. Do not blindly commit this lock or claim Critical closure without explaining/removing legacy transitive copy with npm and retesting.
- Old isolated Vercel sandbox stopped (HTTP 410); it cannot be reused. Regenerate and validate a reproducible lock on current branch through a fresh sandbox or approved npm-enabled runner, inspect `npm ls next shell-quote --all`, then commit the exact generated output. Do not hand-edit dependency lock content.
- No merge, deploy, DB, OTA, APK/AAB. Stage 2 remains OPEN.
