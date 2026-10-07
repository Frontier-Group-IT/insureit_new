# INSUREIT Production Assurance Handoff — 2026-10-07

## Purpose
Durable engineering handoff for the production-assurance programme. This is **not** the management certification report. Future agents must continue from verified evidence here rather than restarting or treating advisor counts as vulnerabilities.

## Operating rule
Complete one assurance class at a time: identify -> reproduce safely -> root cause -> remediate in isolated branch -> run existing regressions -> add/execute regression evidence -> retest -> close. Do not progress while confirmed Critical/High findings in the active class remain unresolved.

Never create APK/AAB unless explicitly requested. Never use destructive production security proofs. Never expose secrets/PII in evidence.

## Stage 1 — security/access-control evidence
- Supabase project: `ilzhsfqqjyppzzvfscmh`, PostgreSQL 17, ap-northeast-2.
- All 165 public base tables observed with RLS enabled.
- Initial confirmed critical/high paths included anonymous DELETE policy/grant inheritance, anonymous privileged SECURITY DEFINER RPCs, privileged audit views, and broad POSP storage policies. Earlier remediation work hardened these surfaces; re-audit/classification must continue until zero known Critical/High access-control findings.
- High-impact RPCs previously identified for hardening/retest: `get_policy_business_report_v4`, `issue_partner_identity`, `issue_legacy_partner_identity`, `ensure_legacy_partner_record`, `post_accounts_excel_reconciliation`, `finalize_policy_intake_motor_v1`.
- `can_manage_customer_associated_onboarding` delegates to an auth.uid()-bound ownership/membership helper; closed by design.
- No broad authenticated write policy was found in the later RLS sweep. Open true policies observed were read-only reference/catalog data.
- Sensitive storage buckets are private; logo asset buckets are intentionally public.
- `support-ticket-files` is private but lacks bucket-level file-size and MIME allow-list constraints; bucket was empty at inspection. Remediation still required through normal migration path.
- One manufacturer read policy uses deprecated `auth.role() = 'authenticated'`; replace through tracked migration.
- Supabase leaked-password protection was reported disabled; enable if supported and verify.

## Stage 1 — database performance
Current advisor snapshot: 154 unindexed FKs; 95 auth/RLS init-plan warnings across 32 tables; 176 unused indexes; 73 multiple permissive policy warnings; 3 duplicate indexes. These are advisor findings, not equivalent to defects.
- Duplicate cases: `claims.claim_no`, onboarding status/updated, `customers.profile_id`; retain constraint-backed index and remove only proven duplicates.
- `policy_payin_bills` and `policy_party_snapshots` are stronger FK-index candidates based on safe scan telemetry.
- RLS init-plan optimization requires a dedicated semantics-preserving migration and regressions.
- Multiple permissive policies may encode intentional staff/intermediary/customer access; do not merge blindly.

## Stage 1 — supply chain/infrastructure
- GitHub repository currently reports public visibility: High governance finding pending integration-impact validation before changing visibility.
- No repository evidence found for generic CodeQL/Semgrep, Gitleaks/TruffleHog, Dependabot, or equivalent generic SAST/SCA/secret-history gates.
- Vercel is Git-linked; pushes to main can create production deployments. Production promotion should ultimately require green verification.
- Vercel currently reports Node 24.x while CI uses Node 22.
- Vercel generated deployment URLs have SSO protection; custom production domain is public as expected.
- Historical iCall secret metadata supports that credentials were edited, but does not independently prove old upstream credentials invalid.
- `xlsx@0.18.5` existed in lockfile; no repository import/use found, so removal is preferred.

## Stage 2 — active supply-chain remediation
Active PR: **#2918**, branch `security/assurance-stage2-supply-chain-2026-10-07-v2`. Superseded #2917 was closed without merge.
- removes unused vulnerable `xlsx@0.18.5`;
- changes Web/Partner/Customer verification to deterministic `npm ci`;
- adds High/Critical production dependency audit gate;
- pins repository Node runtime to 22.x;
- no business logic/DB schema/APK/AAB changes;
- must not merge until required verification is green.

### First #2918 CI run
Head `21fac5348ba173d3e986e601491b37172ad163d1`:
- Web #5579 FAILED at new dependency audit.
- Partner #574 FAILED at new dependency audit.
- Customer #1081 FAILED at new dependency audit.
- Dependency installation succeeded.
- npm install output reported 63 full-tree advisories: 21 moderate, 40 high, 2 critical. This includes dev dependencies and is not yet the production-only count.
- Web audit additionally used the wrong lockfile context; patched on branch. Do not treat that particular failure as an application defect.
- Never run `npm audit fix --force` blindly. Extract production-only advisory identities/reachability, then safely upgrade/replace/remove.

## Remaining Stage 2 queue
1. Correct #2918 dependency gate and obtain exact production-only High/Critical advisories.
2. Remediate every reachable High/Critical production dependency safely; rerun full CI.
3. Add generic SAST and secret-history scanning with controlled false positives and no secret disclosure.
4. After green merge, align Vercel Node runtime and verify production.
5. Validate integration impact, then make repository private if safe.
6. Make production promotion depend on green verification.
7. Create tracked Supabase migrations for support upload constraints, deprecated auth.role policy, proven duplicate indexes, high-value FK indexes, and safe RLS init-plan optimization.
8. Re-run live advisors and explicit access-control queries; close only evidence-backed findings.

## Evidence discipline
Record commit SHA, PR, environment/deployment/build identity, exact command/tool, result, raw counts/metrics, finding IDs, remediation commit/PR, and retest result. Never turn examples or advisor counts into claimed results.

## Next safe step
Inspect the newest #2918 workflow run after the audit path patch. Extract exact production-only advisories from CI, remediate them without force upgrades, then allow the full regression/typecheck/lint/build suite to execute. Update this file after every meaningful checkpoint.
