# INSUREIT Production Assurance Handoff — 2026-10-07

## Purpose
Durable engineering evidence for the production-assurance programme. This is not the final management certification report.

## Mandatory operating rule
Finish one assurance class completely: identify -> reproduce safely -> root cause -> remediate in an isolated branch -> regress -> retest -> evidence-backed close. Do not progress while confirmed Critical/High findings in the active class remain unresolved.

Never create APK/AAB unless explicitly requested. Never expose secrets/PII. Avoid destructive production proofs and untracked live schema drift.

## Current active class: Stage 2 supply-chain / dependency hardening
Earlier PRs #2917, #2918 and #2922 were superseded without merge as main advanced. Current branch: `security/assurance-stage2-supply-chain-2026-10-07-v5`, based on the latest main observed on 2026-10-07.

### Baseline audit evidence
Workspace-scoped production dependency audit before remediation:
- Web: 14 total advisories; 11 High; 1 Critical.
- Customer app: 80 total; 65 High; 1 Critical.
- Partner app: 70 total; 58 High; 1 Critical.
These are npm dependency-graph findings, not equivalent to independently demonstrated exploitability.

### Controlled sandbox
A disposable Vercel sandbox in `bom1` was created with a shallow clone of main and no production credentials. It was used only for dependency generation/audit/typecheck/build experiments.

### Verified candidate patch result
Candidate set: Next.js 15.5.24 plus conservative same-major transitive patches for shell-quote, compression, undici, nanoid, js-yaml and source-map-js.
Observed audit result:
- Web Critical 1 -> 0; High 11 -> 8 in first candidate run.
- Customer Critical 1 -> 0; High 65 -> 61.
- Partner Critical 1 -> 0; High 58 -> 53.
Therefore every observed Critical advisory can be removed without an Expo/native migration.

### Corrected xlsx finding
An earlier repository search suggested xlsx might be unused. Fresh main/typecheck proved that was false. Do NOT remove xlsx without replacement.
Current main imports xlsx in:
- `app/accounts/reconciliation-upload-actions.ts`
- `app/accounts/reconciliation-transaction-upload-actions.ts`
- `app/accounts/business-mis-export/route.ts`
- `app/accounts/reconciliation-transaction-template/route.ts`
The first two parse uploaded user workbooks using `XLSX.read(await file.arrayBuffer())`; this is a reachable untrusted-input path for the known SheetJS parser advisories. Treat as a real High Web finding.

A sandbox experiment using official SheetJS CE 0.20.3 tarball from SheetJS CDN:
- TypeScript passed.
- XLSX write/read round-trip passed.
- npm audit no longer reported xlsx.
- This is only a remediation candidate because it adds a non-npm CDN supply-chain source. Require stronger reconciliation import/export regression fixtures and provenance decision before commit.

### Rejected experiments
- Removing xlsx: rejected; breaks four Accounts/reconciliation modules and TypeScript.
- Global `brace-expansion=1.1.21` override: rejected; it invalidated a newer minimatch subtree that requires brace-expansion 5.x.
- `braces=3.0.4`: rejected; no such npm version exists. Current reviewed advisory reports <=3.0.3 affected with no patched version.
- Blind `npm audit fix --force`: prohibited; would request framework-major changes including Tailwind 4 / Expo 57.

### Web residual findings
After safe patch experiments, residual High dependency groups include:
- Tailwind 3.4.19 -> chokidar / micromatch / fast-glob -> braces 3.0.3. Current braces advisory has no patched npm version; npm recommends Tailwind 4 as a major migration.
- sharp: Next 15.5.24 resolves sharp 0.34.5, but current npm advisory metadata still flags versions through the current affected range; verify upstream fixed release before changing.
- xlsx 0.18.5: real reachable parser risk as above.
Do not claim Web High=0 yet.

### Mobile residual findings
After safe patches, most remaining High findings cluster under Expo SDK 54 / React Native / Metro. npm recommends Expo 57.0.27 as a semver-major remediation. This is a native/runtime migration and must not be silently performed; no APK/AAB without explicit user instruction.

## Earlier security/access-control evidence
- Supabase project `ilzhsfqqjyppzzvfscmh`, PostgreSQL 17, ap-northeast-2.
- All public base tables observed with RLS enabled.
- Earlier confirmed dangerous anonymous DELETE/RPC/view/storage paths were hardened in prior work; continue explicit retest before final closure.
- Sensitive buckets private; logo buckets intentionally public.
- `support-ticket-files` remains a hardening item for MIME/file-size constraints through tracked migration.
- One manufacturer read policy uses deprecated auth.role; migrate safely.
- Supabase leaked-password protection was reported disabled; verify/enable if supported.

## Database performance baseline
Advisor snapshot previously observed: 154 unindexed FKs, 95 auth/RLS init-plan warnings, 176 unused indexes, 73 multiple permissive warnings, 3 duplicate indexes. Advisor counts are not defect counts. Do not bulk-fix.

## Governance/infrastructure
- Repository observed public: High governance finding pending integration-impact validation before visibility change.
- No repository evidence found for generic CodeQL/Semgrep, Gitleaks/TruffleHog, or equivalent generic SAST/secret-history gates.
- Vercel Git integration means main can deploy production; eventual production promotion should depend on green assurance gates.
- Vercel project was observed on Node 24.x while target CI/runtime contract under evaluation is Node 22.x.

## Next safe actions
1. Build v4 Stage 2 PR from current main; do not copy stale branches wholesale.
2. Commit only verified dependency/CI changes; generate lockfile using npm.
3. Add regression coverage for reconciliation XLSX import/export before changing SheetJS.
4. Resolve Web reachable High findings or document a narrowly justified residual only when no safe patch exists.
5. Keep Expo/native migration separate; no APK/AAB.
6. Add SAST and secret-history scanning after dependency class reaches its closure criteria.
7. Re-run full Web/Customer/Partner CI before merge.
8. Update this file after every meaningful finding/fix/retest.


## Branch continuity update
- v4 diverged when main advanced by six commits touching Partner UI, AGENTS.md and CURRENT_CHAT_HANDOFF.md but not the Web Accounts/XLSX implementation.
- v5 was recreated from that newer main. Assurance changes must be reapplied semantically; do not overwrite newer AGENTS content.


## Web residual reachability classification — 2026-10-07
- A production-only npm tree check (`npm ls --omit=dev`) showed Tailwind CSS and its chokidar/fast-glob/micromatch/braces chain are absent from the deployed production dependency tree. Treat these as build/development supply-chain exposure, not remotely shipped Web runtime code. They still require lifecycle remediation before final certification, but do not equate their audit count with remotely exploitable portal findings.
- `js-yaml` and old `brace-expansion` were also absent from the production-only Web tree.
- Next 15.5.24 production tree still includes `postcss@8.4.31`, with `nanoid@3.3.16` and `source-map-js@1.2.1`, plus `sharp@0.34.5`.
- A parent-scoped npm override attempting to replace Next's nested PostCSS children did not change the installed nested versions and made npm report the tree invalid. Rejected; do not commit.
- Current GitHub-reviewed PostCSS advisories require attacker-controlled CSS/sourceMappingURL input and are patched in newer PostCSS 8.5.x. Repository search found no application runtime import/use of PostCSS and no sourceMappingURL handling. Classify current direct application reachability as not demonstrated, while retaining the vulnerable nested dependency as a supply-chain blocker.
- Current GitHub-reviewed Sharp advisories affect processing of untrusted images. Repository search found no `next/image` imports, `<Image>` use, `/_next/image` references, `remotePatterns`, or Next image configuration. Direct application reachability is therefore not demonstrated. Do not call this a false positive: `sharp@0.34.5` is genuinely vulnerable and remains installed through Next.
- SheetJS CE 0.20.3 compatibility regression on a fresh Node 22 sandbox passed: hidden `INSUREIT_META` sheet, workbook custom properties, editable reconciliation values, XLSX round-trip, and Web TypeScript all preserved. This is technically compatible; distribution/provenance decision remains before commit.
