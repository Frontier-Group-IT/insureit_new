# Stage 2 residual dependency exposure review — 2026-10-08

**Status: preliminary triage, not VAPT certification.** Evidence source: `npm audit --omit=dev` GitHub Actions run 37744384078 / artifact 11535213085 on PostCSS/Sharp PR head 2b8d483b73b51f64e2076ddeeeb1e23d24b42fb7, subsequently merged as PR #2973 (`5e7d3306eea2a3382a03955e2225a72434e13774`).

## Latest verified audit baseline
| Workspace | Critical | High | Moderate | High focus |
| --- | ---: | ---: | ---: | --- |
| Web | 0 | 5 | 2 | `braces`, `chokidar`, `fast-glob`, `micromatch`, `tailwindcss` |
| Customer | 0 | 31 | 23 | Expo CLI/Metro/React Native families plus others |
| Partner | 0 | 52 | 14 | Expo CLI/Metro/React Native families plus others |

Numbers are *package vulnerability aggregates*, not proven independent attack paths. Re-run after any merged dependency changes.

## Tailwind 3 Web dependency chain
- `apps/web-portal/package.json` declares Tailwind ^3.4.17; resolved `tailwindcss@3.4.19`. Audit paths: `node_modules/tailwindcss` via `chokidar` and `fast-glob`; `node_modules/fast-glob` nested under Tailwind via `micromatch`; `micromatch` and `chokidar` via `braces@3.0.3`.
- Likely compile/watch pattern exposure rather than request-time Web input, *but this is a hypothesis until deployed-bundle import graph and runtime paths are verified.* ReDoS / stack exhaustion risk from crafted glob patterns cannot be waved away solely by `--omit=dev` audit classification.
- npm's proposed Tailwind 4.3.3 upgrade is a major CSS/configuration migration. **Do not auto-upgrade** while the functional Web portal is working. Compare Tailwind 4 CSS output, design tokens, existing PostCSS config, responsive classes, and visual snapshots in a separate branch.
- Advisory exceptions, if needed, require owner, dependency path, entrypoint/data reachability proof, mitigations, review expiry and independent auditor agreement.

## Expo/React Native (both installed Android apps)
- Root/workspaces retain `react-native@0.81.5` and Expo `^54.0.35`; current app native/runtime and OTA compatibility must be preserved.
- Audit examples: `expo` via `@expo/cli` and config; `metro` via Metro configs/file-map; `node-forge` via `@expo/code-signing-certificates`; `react-native` via native community CLI/virtualized lists. `undici` is a separate Node HTTP implementation flagged below patched 6.28.0.
- CLI/Metro findings *may* be build tool only, but expo-updates/code-signing and React Native vulnerabilities cannot be deemed unreachable without Android JS bundle/native library inspection and verified installed-runtime behavior. The audit group count does not identify installed binary reachability.
- npm upgrade suggestions to Expo 57 / React Native 0.87 are major changes; require explicit native migration approval, separate Expo compatibility report, EAS runtime/channel analysis, installed-device smoke, and any new APK/AAB only upon separate user request.
- Static checks/Expo web preview builds **do not** substitute for installed Android device testing.

## Controlled patch scope and remaining assurance gate
- After PRs #2971 and #2973, XLSX 0.20.3, PostCSS 8.5.24 and Sharp 0.35.5 resolved on `main`; Web/Customer/Partner CI passed for both.
- Current low-disruption experimental candidate: `undici@6.28.1` and `compression@1.8.2` root npm overrides. Disposable sandbox terminated (exit 143 / 410) before audit tests completed, so **no passing claim from sandbox**. A Node 22 GitHub clean install/dependency-tree and complete workspace CI must validate before any merge.
- Stage 2 remains OPEN until every residual High has either a compatible patch and regression evidence or a formal, time-limited, independently reviewable exception.
- Do not perform production-destructive tests, live credential exfiltration, database changes, OTA publishing, or APK/AAB builds as part of this assessment. Final independent VAPT and full smoke test remain pending.
