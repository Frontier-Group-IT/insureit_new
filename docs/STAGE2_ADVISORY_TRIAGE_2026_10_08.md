# Stage 2 — advisory-level triage from verified GitHub artifact (2026-10-08)

**Evidence state: VERIFIED AUDIT COLLECTION / OPEN RUNTIME REACHABILITY / NOT VAPT CERTIFIED.**

Source: GitHub Actions run [37751295276](https://github.com/Frontier-Group-IT/insureit_new/actions/runs/37751295276), artifact **11537752475** (SHA256 `1019716f8c1f253b03f6b35fe62d1c46e7b6fec4f5d08c2991c7108370748b92`), PR branch source SHA `312c26ad180f7ee7e820bfd83fadacb01b412d12` reported by `commit-sha.txt`; artifact run head `46801a3d2720052ca9e312b61a3b4d214be8c7c1` (GitHub checkout can use PR merge ref, so retain both). Workflow clean install, `npm ls --all`, and three JSON reports succeeded. **Not** a fresh post-merge audit of main commit `9ac7b9c0c9d53b783e1756ea649c62f72d05da6f`.

## Verified audit counts

| npm workspace | Critical | High | Moderate |
|---|---:|---:|---:|
| Web | 0 | 5 | 2 |
| Customer | 0 | 29 | 23 |
| Partner | 0 | 50 | 14 |

Aggregate npm vulnerability entries are not evidence of 84 exploitable attack paths.

## Web: all five High findings

| Package | Installed audit location | Root cause / remediation constraint |
|---|---|---|
| `braces` | `node_modules/braces` | [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), transitive glob input handling |
| `chokidar` | `node_modules/chokidar` | Tailwind 3 watcher dependency |
| `fast-glob` | `node_modules/tailwindcss/node_modules/fast-glob` | Tailwind nested dependency; npm marks fixAvailable true, requires testing exact version/dedupe |
| `micromatch` | `node_modules/micromatch` | Glob matching dependency |
| `tailwindcss` | `node_modules/tailwindcss` | Direct Tailwind 3 build chain; audit suggests Tailwind 4.3.3 major, not a safe automatic fix |

**Reachability status: UNKNOWN.** Source-level evidence suggests CSS compile/watch use, but production bundle/route imports and whether attacker input can reach patterns have not yet been checked. Do not label these benign merely because Tailwind is a build tool or report `--omit=dev` was used.

## Mobile high-priority triage targets

- **Both apps:** `image-size`, advisories [GHSA-5p2g-fcmc-qvqq](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq) and [GHSA-w3rx-r6r6-pgpr](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr), audit says patch candidate available. Inspect whether invoked by Metro/CLI at build-time or shipped executable code; test exact compatible lock-only override.
- **Both apps:** `node-forge`, [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv). Audit's proposed downgrade of `expo-updates` to 0.11.7 is **not an acceptable automatic migration**. Validate SDK 54 OTA code-signing/certificate exposure.
- **Both apps:** `@expo/cli`, Metro, Jest-family and React Native entries must be traced to developer/build execution versus installed Android JS/native runtime. Audit recommendation to switch Expo to 44 or RN to 0.87.1 must not be applied blindly.
- **Both apps:** `react-native-reanimated` and `react-native-worklets` show patch candidates; first confirm SDK/native ABI/runtime/update-channel compatibility, since an OTA cannot replace native libraries.
- **Partner:** `expo-router`, navigation libraries, expo modules, and device integrations need direct runtime reachability/compatibility assessment. Suggested `expo-router@58.0.16` is a major change, not approved.
- **Partner:** `@react-navigation/native` and related packages have potential patch candidates; validate matching compatible peer versions and live navigation regressions before any changes.

## Reproducible closure workflow

1. Run the merged on-demand Stage 2 dependency workflow on **exact latest main** (needs an authorized GitHub workflow_dispatch execution; connector currently has no dispatch action). Keep immutable SHA, `package-lock.json` checksum and artifact digest. Never substitute PR audit for exact main.
2. For each High, record full nested parent chain (`npm explain <package>`), GHSA/CVE, vulnerable version, patched candidate, direct/transitive and shipped runtime entrypoint.
3. On isolated branches, test **compatible minor/patch only**, `npm ci`, `npm ls --all`, audit, all relevant CI, and browser/mobile behavior. No `npm audit fix --force`.
4. Tailwind 4 migration requires a separate visual/build experiment: PostCSS config, generated CSS, design system, responsive screens and pixel-sensitive routes.
5. Expo SDK/RN upgrades require explicit native migration approval, runtime/channel verification and installed-device evidence. No APK/AAB without explicit request; no OTA from assurance branch.
6. Prior to external VAPT, verify approved production READY source SHA behind canonical portal, finish authenticated role/Accounts XLSX claims/policy smoke and safe RLS/storage testing.
7. Time-limited exceptions require owner, affected artifact, path, threat model, mitigation, compensating control, date to retest and independent reviewer approval.

**No dependency/runtime, database, production deployment, OTA or APK/AAB change is authorized by this document.**
