# INSUREIT Stage 2 security assurance — complete continuation handoff (8 October 2026)

**State: OPEN, NOT CERTIFIED.** This handoff supersedes incomplete narrative summaries but not the underlying primary evidence. Repository `Frontier-Group-IT/insureit_new`; canonical website `portal.insureit.in`. Parent tracking [#2980](https://github.com/Frontier-Group-IT/insureit_new/issues/2980); `image-size` [#2985](https://github.com/Frontier-Group-IT/insureit_new/issues/2985). Consult `AGENTS.md`, `docs/ASSURANCE_AUDIT_CHECKPOINT_2026_10_08.md`, `docs/STAGE2_DEPENDENCY_EXPOSURE_REVIEW_2026_10_08.md`, and `docs/STAGE2_ADVISORY_TRIAGE_2026_10_08.md` for full prior state.

## Strict verification language and release boundaries
- MERGED != DEPLOYED; GitHub PASS != live app smoke PASS; dependency audit count != a proven attack path; OTA PUBLISHED != installed-device verified.
- Never claim issue-free, VAPT certified, or safe-to-release until full independent evidence/retest exists.
- Do **not** create APK/AAB without explicit user request; no OTA publish, production deployment, migration, live destructive/abuse/load tests or credential disclosure during dependency assurance. No blind `npm audit fix --force`, Expo SDK/RN/native upgrade, or Tailwind major upgrade.
- Each implementation on isolated branch -> current-`main` PR -> exact-head checks -> merge only when green and source-current -> separately verify runtime and rollout. Keep AGENTS.md ledger and dedicated documentation updated.

## Completed remediation from previous Stage 2 work
| PR | What happened | Evidence |
| --- | --- | --- |
| #2964 | Next 15.5.27, shell-quote 1.11.0 Critical supply-chain remediation | MERGED `de397d4f1e6a3028b65f039782780a0c22635927`; Web #5668, Customer #1104, Partner #608 passed |
| #2966 | nanoid 3.3.18, source-map-js 1.2.2 | MERGED `49700da78e0bc93a181d149276ebd259bbd94c75`; Web #5674, Customer #1108, Partner #612 passed |
| #2971 | XLSX npm 0.18.5 -> official SheetJS CE 0.20.3 tarball, synthetic Accounts workbook round-trip tests | MERGED `105d74dddbfa1c85955ea32f5b28ad223073745b`; authenticated end-to-end Accounts tests still pending |
| #2973 | PostCSS 8.5.24 and Sharp 0.35.5, CSS/PNG tests, lock dedupe | MERGED `5e7d3306eea2a3382a03955e2225a72434e13774` |
| #2974 | undici 6.28.1 and compression 1.8.2 via valid Node 22 lock | MERGED `31c0a9a7ef815d825d9d50897a771ed805e7d271` |
| #2976 | Stage 2 evidence consolidation | MERGED, documentation only |
| #2978 | Verified live deployment gap in canonical Vercel production | MERGED `cf4ec0e9de8e650f50f3a66cc63e2fae77fefe61`, documentation only |

## This conversation’s chronological continuation (all results)
1. On 8 Oct created [issue #2980](https://github.com/Frontier-Group-IT/insureit_new/issues/2980): eight ordered gates for fresh audit, Tailwind and mobile reachability, exact-SHA deployment, authenticated Web/mobile smoke, authz security tests, external VAPT. This is tracking, not a completed test.
2. Draft PR #2981 added `scripts/stage2-capture-dependency-audit.sh` and `.github/workflows/stage2-dependency-evidence.yml`. Original head `c0dfdbd02a9971b7d13e512354eee121c43172bf`, **Stage 2 dependency evidence #2** run `37747994803` and **Verify Web #5755** run `37747994848` PASSED. Evidence artifact **11537040877**. Branch became 15 commits behind main; original PR must not be merged.
3. Rebased onto current main as **PR #2982**; exact head `46801a3d2720052ca9e312b61a3b4d214be8c7c1`, **Stage 2 evidence #4** run `37751295276` and **Verify Web #5757** run `37751295331` PASSED. Artifact **11537752475**, archive SHA-256 `1019716f8c1f253b03f6b35fe62d1c46e7b6fec4f5d08c2991c7108370748b92`, 30-day retention through 7 November. PR **MERGED `9ac7b9c0c9d53b783e1756ea649c62f72d05da6f`**. Workflow runs clean `npm ci --ignore-scripts`, `npm ls --all` and saves audit JSON per workspace. **Workflow PASS means collection succeeded even if vulnerability counts are nonzero**.
4. From that PR artifact, counts **Web 0 Critical/5 High/2 Moderate; Customer 0/29/23; Partner 0/50/14**. Web High: `braces`, `chokidar`, `fast-glob`, `micromatch`, `tailwindcss`. `image-size`, `node-forge`, Metro/Expo, Reanimated/Worklets, navigation require mobile reachability review. Important: PR action checkout may be a merge ref rather than original head; record both `commit-sha.txt` and the run's `head_sha`. **This is not an independent audit of the final merged main commit**.
5. PR #2984 documented advisory-level evidence in `docs/STAGE2_ADVISORY_TRIAGE_2026_10_08.md`; **Web #5765** run `37756717175` PASSED; **MERGED `6ad5a47c56434d870370480dad19c692bb6b69ed`**.
6. Created [issue #2985](https://github.com/Frontier-Group-IT/insureit_new/issues/2985) to assess `image-size`. Artifact dependency tree showed `image-size@1.2.1` reached via Customer `uniwind > metro > image-size` and Expo code-signing chain `node-forge@1.4.0`. These paths alone do not establish whether untrusted content reaches the parser, or whether it is shipped inside an installed Android app.
7. Draft PR #2986 introduced read-only synthetic PNG/Metro API test for both apps: `scripts/stage2-metro-image-contract.cjs` and `.github/workflows/stage2-metro-image-compatibility.yml`; **Metro compatibility #1** run `37758000558` and **Web #5769** run `37758000563` PASSED. With main advancing again, original PR was not merged.
8. Rebased replacement **PR #2989**; head `e9d937ed26f80fcc16a6ab812736657c0791f0f2`; **Metro compatibility #2** run `37758728063` and **Web #5778** run `37758728211` PASSED; **MERGED `112a3d0ed68cd627795893653ba160d013ea7f6a`**. Synthetic 1×1 PNG ensures current Metro-resolved `image-size` API returns dimensions for both apps; **does not patch the advisory**.
9. Later unrelated main activity occurred (e.g. Exchange PR #2990). Main observed at handoff preparation `602dab9717d41d6ab89a8cfec10db74bd6c5ab35`; refresh HEAD before further edits or merges.
10. **No production deploy, DB migration, OTA publish, APK/AAB build or real authenticated/mobile smoke test in these Stage 2 turns.** No changed `image-size` dependency yet. All primary security tracking remains in #2980 / #2985.

## Critical correction — official `image-size` fixed releases, version/API constraints
- Historical GitHub issue [advisory-database #9028](https://github.com/github/advisory-database/issues/9028) described `image-size >=2.0.3` as unpublished on **8 August 2026**. That statement is **outdated as of October 8**.
- [Official npm image-size versions](https://www.npmjs.com/package/image-size?activeTab=versions) currently list **2.0.3 and 2.0.4** published **14 September 2026**, dist-tag `latest: 2.0.4`, `legacy: 1.2.1`. [Snyk version history](https://security.snyk.io/package/npm/image-size/versions) identifies 2.0.3/2.0.4 with no direct findings for those two advisories; [GHSA-w3rx-r6r6-pgpr](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr) names 2.0.3 patched, affected 0.6.3–2.0.2. Verify other GHSA `GHSA-5p2g-fcmc-qvqq` as well.
- Current Metro chain uses **`image-size@1.2.1`**. A forced global `image-size@2.0.4` override is a **major change** and may break Metro's 1.x callable API, image imports or Expo bundling. Published fixed release existence **does not equal a compatible patch**. Do not automatically swap to third-party forks without provenance, supply-chain, API and license validation.
- Preferred assessment: inspect exact Metro `require('image-size')` and parsing uses, resolved parents for **both** apps with `npm explain image-size`, determine if images originate only in trusted local build assets or attacker-controlled inputs. Attempt a patch in isolated branch, preserve Node 22 generated lock, `npm ci` + `npm ls` + synthetic test + Expo/Metro exports + both CI suites. Do not force v2 or relax audit silently; if no same-API fix exists, document time-limited exception with actual reachability proof and owner, plus independent reviewer sign-off.

## Other unresolved security gates
- Tailwind 3.4.19's Web build chain `braces/chokidar/fast-glob/micromatch/tailwindcss`: prove runtime vs build/watch exposure, inspect CSS/browser/server bundles, compare compatible patches; Tailwind 4 is a separate major visual migration, not authorized.
- Expo SDK 54 / RN 0.81.5, Metro, node-forge, Expo Updates code signing, Reanimated/Worklets, navigation: assess build/native/JS/OTA reachability before changing any versions; real device smoke essential. No APK/AAB without request.
- Authenticated Accounts XLSX export/import/preview/reconciliation, Policy/OCR/Claims/Vehicle/Partner/Customer/Operations smoke, negative and permission paths; Supabase Auth/RLS/RPC/storage BOLA and upload tests.
- Vercel domain `portal.insureit.in` verified on project `insureit_new` ID `prj_OLXA2UB1LwMd0UidP8MNa1O9MLuq`, team `team_DsOUqnF8Pbd7YGNt8RCE8NgA`; previous latest READY production deployment `dpl_BFkWPLb8WN3tLeVPJ6icwSoebK2C` sourced **old** `d3974a94899e1bc2250a00fe1a8baa498b6188e7`. Recheck *actual current domain deployment* exact SHA via controlled release before live patched claim. There has been no verified production rollout of these fixes in Stage 2.
- Fresh **post-merge main** dependency audit (on-demand workflow is installed but connector does not provide `workflow_dispatch`; a PR run does not substitute for main audit). Scope and schedule authenticated smoke, performance/load with bounded non-destructive tests, third-party VAPT/retests, final management sign-off.

## Future agent — immediate safe continuation
1. Read this handoff and AGENTS; check current GitHub HEAD and any in-flight PRs. Verify statuses independently, especially #2980, #2985.
2. Get fresh exact-`main` Node 22 audit artifact using approved dispatch, including SHA/lockfile checksum. Use evidence file, not audit counts from previous PR branch.
3. For `image-size`, verify live npm registry tags and Metro v1 API; inspect the two apps' dependency paths and dangerous image entrypoints. Execute isolated same-API security patch/mitigation proof only after compatibility. Do not merge an unverified dependency bump.
4. Prove Tailwind build-only claims with entrypoint tracing; consider limited compatible overrides in isolated PR with existing CSS build + visual tests.
5. Preserve all results in this file, brief AGENTS.md ledger, #2980/#2985 and test artifacts; secure third-party review and retests before any certification.
