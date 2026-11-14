# INSUREIT managed recovery — R0/R1 preflight and first import approval gate (14 Nov 2026)

**Status: PREPARED ON A SEPARATE PR, NOT RUN AGAINST R2 FROM THIS WORKFLOW.** This document supplements, and does not replace, [the original dated handoff](INSUREIT_SUPABASE_R2_STORAGE_BACKUP_HANDOFF_2026_10_31.md) and [master DR issue #4264](https://github.com/Frontier-Group-IT/insureit_new/issues/4264). Full service disaster recovery remains **NOT CERTIFIED**.

## Source / destination invariant

| | Production source (READ ONLY) | Managed recovery target (NO IMPORT YET) |
|---|---|---|
| Ref | ilzhsfqqjyppzzvfscmh | klnodxnmlqbofolxxrsr |
| Project | Insureit_Web | INSUREIT_VAPT_ISOLATED |
| Plugin account | Insureit_Pro_Plan | Shahdolho Account |
| Organization | SANKALP INSURANCE BROKERS PRIVATE LIMITED | Sankalp, separate Free organization |
| PG release at 14 Nov observation | 17.6.1.164 | 17.11.0.019 |
| Public tables | 182 | 0 |

Never point a recovery command at the production source. A managed project's UI label "main/PRODUCTION" does not make it the INSUREIT production source.

## R0: read-only verified inventory and open blockers

Read-only inspections on 14 November recorded **87 Auth users, 91 identities, 9 Storage buckets and 3,652 Storage objects in the source**, and **0/0/0/0** in the target. The live source has 182 public tables and target has none. Source has 16 and target 15 role names under the current non-pg_ query; the only missing name on target is cli_login_postgres. Source and target have respectively 22 and 24 pg_auth_members rows under the current direct catalog query, and 401 vs 7 SECURITY DEFINER functions. These are **live, time-specific observations**, not immutable snapshot counts; prior counts in the original handoff remain historically valid.

* Target organization Free/Nano was verified, but dashboard grace-period quota warnings, current billable capacity, actual remaining DB/storage quotas and approved costs require owner review. Historical fully verified Storage manifest holds 3,633 objects / 1,728,446,586 decrypted bytes; do not upload those files to a Free target without an approved quota/cost decision.
* The target is a network-accessible managed service. Separate organization does **not** prove private customer-data access. Confirm organization/project members, database network restrictions, Data API exposure, RLS policies, backup retention and permitted synthetic test credentials.
* Supabase target security advisor reports the built-in public.rls_auto_enable() SECURITY DEFINER event-trigger function is granted EXECUTE to anon and authenticated. Catalog review confirmed the grants and event-trigger return signature. The advice is a review item, **not proof of a directly callable exploit**. Obtain supported remediation decision before production PII import.
* Verify the target does not feed any live Customer/Partner/Ops clients and that Auth SMTP, OAuth, SMS, webhooks, Realtime broadcasts, Edge Functions and scheduled external jobs cannot contact real customers or business partners.
* The early failed PostgreSQL v2 backup workflow log might have exposed a malformed password-containing hostname; verify restricted log access and coordinate actual credential rotation only if confirmed. Never publish suspected fragments.

**STOP** before real customer data if any of the above privacy, quota, or secret-custody checks remain unresolved.

## R1: live catalog compatibility baseline — not archived snapshot proof

| Category | Source | Target | Preflight interpretation |
|---|---|---|---|
| PostgreSQL | 17.6 | 17.11 | Same major; managed schema compatibility unproven |
| Installed extensions | 8 | 5 | hypopg and pg_trgm available but not installed; index_advisor available at 0.2.1 instead of installed 0.2.0 source; Vault installed 0.3.2 versus 0.3.1 source |
| auth managed tables | 27 | 27 | Shared column signatures match |
| storage managed tables | 10 | 10 | Shared column signatures match |
| realtime tables | 10 | 3 | Source includes seven additional dated partitions; never replay wholesale |
| vault tables | 1 | 1 | Vault key/encryption compatibility must be reviewed separately |
| supabase_migrations tables | 1 | 0 | Special migration history handling required |
| archived COPY targets | Newer scheduled backup reports 232 | Not evaluated against exact latest TOC yet | Earlier 230-target offline pass applies only to earlier snapshot |

Read-only catalog comparison covered 475 source vs 392 target columns for selected managed schemas. Among shared columns, no type/nullability/identity/generated signature mismatch was observed; 83 source-only columns were in dated Realtime partitions and source migration-history table. **This is NOT complete function, index, constraint, owner, RLS or extension/DDL compatibility.** See the private R2 authenticated TOC preflight.

## Proposed workflow (R0/R1 only)

Workflow: .github/workflows/insureit-managed-recovery-preflight.yml

This PR deliberately provides **no restore implementation or authorization**. The manual job:
1. Requires workflow_dispatch, trusted main, and separate GitHub environment insureit-recovery-isolated with required human reviewers configured in repository settings.
2. Rejects missing/unknown/production destination credentials **before R2 access**. Accepts only db.klnodxnmlqbofolxxrsr.supabase.co as postgres or a Supabase session-pooler host with username postgres.klnodxnmlqbofolxxrsr, PostgreSQL database postgres on port 5432, TLS.
3. Uses dedicated R2 object **read-only** credentials, the existing PostgreSQL-v2 archive decryption key, and the current authenticated encrypted R2 manifest and dump. No R2 PUT/DELETE or R2 retention edits.
4. Inspects the private pg_restore --list TOC in a Docker container with --network none and runs the existing fail-closed full-snapshot TOC coverage verifier.
5. Opens only a TLS-verified, read-only, repeatable-read transaction to the allowlisted target; aggregates installed extensions, schemas, table definitions, roles, memberships, Auth/Storage emptiness, and overlap with archived TOC objects. It never issues DDL, DML, role changes, restore or code deployment.
6. Prints aggregate counts and an explicit REVIEW_ONLY marker, never table names, policy data, customer identities, raw TOC or secrets. Decrypted archive/TOC and diagnostic files are deleted from the ephemeral runner.

**Environment setup (operator action, NOT automated by this PR):**
- Create GitHub environment insureit-recovery-isolated, allow trusted main ONLY and configure required reviewers. Never enable automatic unattended dispatch; verify branch protection and secrets access.
- Set INSUREIT_RECOVERY_DATABASE_URL to a **target-only credential**; preferably a dedicated least-privileged catalog-read identity. URL/password are never put in chat or code. Source or general write-capable application credentials must not be copied into this environment.
- Set RECOVERY_R2_ACCOUNT_ID, RECOVERY_R2_READONLY_ACCESS_KEY_ID, RECOVERY_R2_READONLY_SECRET_ACCESS_KEY with a bucket-scoped Cloudflare R2 identity limited to GET/list (no PUT/DELETE), and RECOVERY_DB_BACKUP_ENCRYPTION_KEY from approved off-GitHub escrow.
- These new environment secrets are NOT created by the PR and are NOT available to PR CI. A job that runs without them should **fail**, not fall back to any production environment.
- Do not enable any scheduled jobs, copy live customer files, configure outbound notification credentials, or change GitHub backup schedules.

**CI:** scripts/backup/test_managed_recovery_preflight.py exercises valid direct/session URLs and rejects production project ref, unknown hosts, transaction-pooler ports, unsafe TLS, unknown query options and missing password. Verify R2 backup code static workflow checks the new workflow is only manual, env-isolated, R2 GET-based and read-only. Existing web checks remain required. Running PR CI uses **synthetic values only**.

## Later stages — NOT approved by this PR

R2 will require a separate reviewed target-changing workflow design and exact TOC allowlist. R3 must validate the latest archive in a disposable PG17 version-compatible environment. R4 managed target import needs **separate explicit written approval of exact archive, approved data families, owner/roles strategy, network/privacy, capacity and rollback plan**. Do not use global pg_restore --clean, drop managed Auth/Storage/Vault, disable RLS for convenience, grant superuser/BYPASSRLS to app users, or copy platform root/signing secrets. Skipped managed data means PARTIAL restoration, never certified service recovery. R5–R8 cover actual row/owner/permission equivalence, isolated Auth/Storage files/Edge Functions, app test, RPO/RTO and independent signoff.

## Status / evidence hygiene

- Reviewable preflight PR: pending actual URL/CI run. **No protected preflight dispatched; no archive restored.**
- Actual output for R2 snapshot, TOC counts and missing managed dependencies must be added only after the protected manual job passes, with its real run link.
- Update the existing authoritative handoff's top section and issue #4264 after validated milestones. Keep old run links and time-specific counts without replacing them with a different snapshot's figures.
- No writes to production ilzhsfqqjyppzzvfscmh, no writes to recovery target klnodxnmlqbofolxxrsr, no R2 deletion/upload or mobile/web release during this preflight preparation.
