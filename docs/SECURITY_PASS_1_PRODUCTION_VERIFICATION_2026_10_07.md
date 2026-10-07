# INSUREIT Internal Security Validation — Pass 1 Production Verification

**Date:** 2026-10-07 (IST)  
**Scope:** Supabase/PostgreSQL authorization boundaries, privileged database functions/views, Storage exposure, role resolution, deny-all tables, and password-reset hardening.  
**System owner authorization:** Internal defensive validation of INSUREIT-controlled systems.  
**Production merge:** `ec216b15f72915f8d562c2eb4c2d69f81c88b37f` (PR #2899)

## Result

**PASS — confirmed first-pass access-control findings remediated and production-verified.**

The current live state has zero remaining instances of the concrete vulnerabilities identified in the first discovery pass:

| Validation | Live result |
| --- | ---: |
| Over-broad `staff_delete_reserved_for_it_super_user` policies | **0** |
| Anonymous execution of public `SECURITY DEFINER` functions | **0** |
| Direct browser execution of `SECURITY DEFINER` trigger/event-trigger functions | **0** |
| Legacy anonymous `posp-documents` read/upload policies | **0** |
| Browser privileges detected on RLS-enabled/no-policy deny-all tables | **0 sampled / none detected across set** |
| Mutable function `search_path` advisor findings | **0** |
| Privileged-view advisor findings | **0** |
| Extension-in-public advisor findings | **0** |

## Changes applied

Nine security migrations are committed on `main`, applied to production, and migration-history versions match the repository:

1. `20261007130000_internal_security_boundary_hardening.sql`
2. `20261007131000_security_function_surface_hardening.sql`
3. `20261007132000_revoke_anon_security_definer_execution.sql`
4. `20261007133000_authenticated_definer_authorization_hardening.sql`
5. `20261007134000_internal_rpc_primitive_hardening.sql`
6. `20261007135000_associated_onboarding_authorization_hardening.sql`
7. `20261007136000_deny_all_table_privilege_hardening.sql`
8. `20261007137000_move_pg_trgm_to_extensions.sql`
9. `20261007138000_internal_claim_progress_helper_hardening.sql`

The production migration-history keys were reconciled to the exact repository versions after the management API initially recorded timestamp-at-apply versions. This reconciliation changed migration-history metadata only; it did not re-run or alter business schema/data.

## Pre-apply evidence

Before production application, all nine migrations were executed together against the current production schema inside one explicit `BEGIN ... ROLLBACK` transaction.

The rollback validation proved:

- over-broad generic delete policies would become zero;
- anonymous `SECURITY DEFINER` execution would become zero;
- browser execution of privileged trigger/event-trigger functions would become zero;
- the 20 Supabase-advisor mutable `search_path` warnings would be pinned;
- the 102 RLS-enabled/no-policy tables would retain deny-all RLS and additionally lose browser DML/SELECT grants;
- the two privileged intermediary audit/cleanup views would become `security_invoker` and browser-inaccessible;
- legacy anonymous POSP document policies would be removed;
- `pg_trgm` could be relocated to `extensions` without breaking unqualified trigram behavior;
- sample trigram verification: `similarity('policy','policies') = 0.454545`.

The transaction was rolled back, so this stage did not mutate production.

## CI evidence

Replacement PR **#2899** was used after the earlier branch became stale.

Canonical verification on the final PR head:

- **Verify web portal #5532 — PASS**
  - all access-control and business regressions;
  - Release blocker security regression;
  - Partner web security regression;
  - Customer Web isolation regression;
  - claim, policy, vehicle, reporting, OCR and voice regressions;
  - TypeScript typecheck;
  - ESLint;
  - Next.js production build.
- **Verify Partner app #559 — PASS**
  - dependency lockfile;
  - release identity and route integrity;
  - resilience/accessibility contracts;
  - pre-APK security/UAT contracts;
  - typecheck;
  - lint;
  - Expo web review export and artifact upload.

No APK or AAB was created.

## Production post-apply evidence

Immediately after the migrations were applied, live SQL assertions returned:

```text
broad_delete_policies       = 0
anon_security_definer_exec  = 0
direct_trigger_exec         = 0
posp_anon_policies          = 0
deny_all_table_browser_privilege_sample = null
```

The current Supabase security advisor now reports only:

- **102 — RLS Enabled No Policy (INFO)**
- **140 — Signed-In Users Can Execute SECURITY DEFINER Function (WARN)**
- **1 — Leaked Password Protection Disabled (WARN)**

Warnings removed by this pass include anonymous `SECURITY DEFINER` execution, mutable function search paths, privileged definer views, and extension-in-public.

## Classification of the 102 RLS/no-policy entries

These tables are intentionally fail-closed/server-only.

Production verification confirms:

- RLS remains enabled;
- no RLS policy exists by design;
- `anon` and `authenticated` no longer retain SELECT/INSERT/UPDATE/DELETE privilege on the set.

Therefore these 102 advisor entries are classified **PASS — intentional deny-all architecture**, not 102 vulnerabilities.

A dummy allow/deny policy is not added merely to silence the advisor because the current design is stricter: browser roles have no table privilege and RLS has no allowing policy.

## Classification of the 140 signed-in SECURITY DEFINER entries

This warning means a signed-in database role can invoke a privileged function; it does not prove that the function lacks authorization.

A recursive function-call review was performed across every currently authenticated-executable public `SECURITY DEFINER` function. A function was considered identity-bound when it either:

1. checks Supabase authentication claims directly (`auth.uid()`, `auth.jwt()`, or request JWT claims), or
2. reaches another public helper that performs such a check.

**Result: 0 authenticated-executable SECURITY DEFINER functions were found outside an identity-bound call chain.**

Additional manual review covered thin wrappers and scoped APIs that do not contain a literal `auth.uid()` call themselves:

- `create_customer_policy` delegates to the authenticated/ownership-checked `create_customer_external_policy`;
- group link/unlink flows call the hardened `assert_group_relationship_manager`;
- employee hierarchy uses `current_employee_id()`, which resolves from `auth.uid()`;
- Partner detail/activity/policy/claim RPCs route through Partner scope helpers, which ultimately derive the signed-in identity and commercial scope.

The 140 advisor entries are therefore classified **REVIEWED / CONTROLLED privileged authenticated interfaces**, not 140 open findings. Future changes remain protected by the repository release-blocker security regression and should preserve the same identity/scope contract.

## Password security residual

The Supabase organization currently reports:

```text
plan = free
tier = tier_free
```

Supabase's current product documentation states that leaked-password protection using the Have I Been Pwned password corpus is available on **Pro and above**.

Therefore the remaining leaked-password advisor warning cannot be eliminated on the current Free tier without a plan change.

Compensating control implemented in this pass:

- Web password reset requires at least 12 characters;
- Partner password reset requires at least 12 characters;
- both require uppercase, lowercase, number and symbol;
- the release-blocker regression prevents the old weaker rule from returning;
- Customer App remains phone-OTP based rather than password based.

This residual is classified **PLATFORM-TIER LIMITATION / COMPENSATING CONTROL PRESENT**, not falsely marked as resolved HIBP protection.

## Security Pass 1 gate

The security/access-control discovery items identified in the first audit pass are considered **closed or explicitly classified with evidence**.

Before another testing family begins, any future change touching RLS, grants, privileged views/functions, Storage policies or authentication must rerun:

- canonical web verification;
- relevant mobile/Partner verification;
- Supabase security advisors;
- the live authorization assertions documented above.

