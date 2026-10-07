# INSUREIT Master Test Register

> Sanitized internal assurance evidence. No secrets or raw PII.

| Test ID | Domain | Test | Method | Expected | Actual evidence | Status |
|---|---|---|---|---|---|---|
| INS-TST-DB-001 | DB security | Current Supabase security advisor | Live advisor read | Enumerate current findings | 102 RLS-no-policy notices; 2 Security Definer Views; 20 mutable search_path warnings | PASS (evidence collected) |
| INS-TST-DB-002 | DB authz | Anonymous access to onboarding cutover audit view | Transaction-scoped `SET LOCAL ROLE anon`; aggregate count only | 0/denied | 118 rows visible | FAIL |
| INS-TST-DB-003 | DB authz | Anonymous access to cleanup-candidate view | Transaction-scoped anon; aggregate count only | denied | 0 current rows, but SELECT grant and sensitive projection verified | FAIL (latent exposure) |
| INS-TST-STO-001 | Storage | Anonymous metadata visibility by private bucket | Transaction-scoped anon; aggregate counts only | 0 for private document buckets | posp-documents=9; customer/policy/claim=0 | FAIL |
| INS-TST-RPC-001 | RPC authz | Accounting reconciliation authorization design | Live function grant + source definition inspection; no write call | session-bound privileged role required | anon EXECUTE; no auth.uid binding; privileged writes present | FAIL |
| INS-TST-RPC-002 | RPC authz | Partner identity issuance authorization design | Live grant + function definition inspection; no write call | authenticated approval capability required | anon EXECUTE; no session binding in reviewed entry points | FAIL |
| INS-TST-RPC-003 | RPC confidentiality | Anonymous intermediary queue access | Transaction-scoped anon; aggregate count only | denied | 118 rows visible; return contract contains phone/name/city/onboarding ID | FAIL |
| INS-TST-RPC-004 | RPC confidentiality | Anonymous business report access | Transaction-scoped anon; aggregate-only summary probe | denied | report returned; policy_count=1117; gross premium field present | FAIL |
| INS-TST-RPC-005 | RPC attack surface | Count anon-executable SECURITY DEFINER functions | Live catalogue query | only intentionally public safe RPCs | 153 anon-executable of 327 SECURITY DEFINER functions | FAIL / REVIEW REQUIRED |
| INS-TST-CLM-001 | Claims RPC | Actor/session binding pattern spot check | Function-definition review | actor must equal auth.uid and role/scope checked | `advance_initial_documents_verified` and `depute_spot_surveyor` correctly bind actor + role/scope | PASS |

## Evidence rules
- Read-only production checks may use aggregate counts and metadata.
- Mutating authorization weaknesses are proven from grants + function body; do not mutate production merely to demonstrate impact.
- Cross-tenant runtime checks will use synthetic identities/records in an approved test environment.
- Every remediation must create a separate RETEST row referencing the exact commit/migration.

| INS-TST-PERF-001 | DB performance | Current Supabase performance advisor | Live advisor read | Establish current baseline | 154 unindexed FK; 95 RLS init-plan; 73 multiple permissive; 176 unused index; 3 duplicate index | PASS (baseline collected) |
| INS-TST-CI-001 | Supply chain | Standard security-tool presence audit | Repository-wide code/workflow searches | SAST + secret scan + SCA/SBOM + DAST evidence gates present | No hits for reviewed standard tool families | FAIL |

| INS-TST-RPC-006 | RPC authz | Policy Intake finalization actor binding | Live function/grant inspection; no mutation | actor derived from auth.uid + capability | actor taken from caller JSON; anon EXECUTE | FAIL |
| INS-TST-RPC-007 | RPC authz | Group link/unlink actor binding | Live helper + entry-point definition inspection | caller identity bound to privileged profile | helper trusts supplied profile UUID; anon EXECUTE | FAIL |
| INS-TST-RPC-008 | RPC authz | External claim stage sync | Function definition/grants; no mutation | claim owner/internal actor required | anonymous executable, no caller auth | FAIL |
| INS-TST-RPC-009 | RPC authz | Corporate onboarding contact sync | Function definition/grants; no mutation | application owner/approved internal role required | callable overload anonymously replaces contacts | FAIL |
| INS-TST-RPC-010 | RPC integrity | Customer activity insertion | Function definition/grants; no mutation | trusted internal path only | anonymous direct insert capability | FAIL |
| INS-TST-RPC-011 | RPC authz | Legacy intermediary migration helpers | Function definition/grants; no mutation | internal/admin authenticated path only | multiple privileged mutators anonymously executable | FAIL |
| INS-TST-WEB-001 | Web hardening | Source-level security header/session review | next.config.mjs + middleware.ts | standard headers + secure cookie flags | CSP/HSTS/frame/nosniff/referrer/permissions headers; HttpOnly/Lax/Secure(prod) cookies | PASS (source); runtime verification pending |
