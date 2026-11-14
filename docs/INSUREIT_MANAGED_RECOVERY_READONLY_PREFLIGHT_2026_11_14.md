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
5. Opens only a TLS-verified, read-only, repeatable-read transaction to the allowlisted target; aggregates installed extensions, schemas, table definitions, roles, memberships, Auth/Storage emptiness, executable public SECURITY DEFINER count, and overlap with archived TOC objects. It never issues DDL, DML, role changes, restore or code deployment.
6. Prints aggregate counts and an explicit REVIEW_ONLY marker, never table names, policy data, customer identities, raw TOC or secrets. Decrypted archive/TOC and diagnostic files are deleted from the ephemeral runner.

**Environment setup (operator action, NOT automated by this PR):**
- Create GitHub environment insureit-recovery-isolated, allow trusted main ONLY and configure required reviewers. Never enable automatic unattended dispatch; verify branch protection and secrets access.
- Set INSUREIT_RECOVERY_DATABASE_URL to a **target-only credential**; the target-only `postgres` direct/session-pooler identity accepted by the initial strict allowlist. This is a privileged account: protect it with mandatory human review, verify-full TLS, bounded read-only transaction and environment isolation. Introducing a dedicated catalog-only target role would require a separately approved target-only role creation and allowlist review. URL/password are never put in chat or code. Source credentials must not be copied into this environment.
- Set RECOVERY_R2_ACCOUNT_ID, RECOVERY_R2_READONLY_ACCESS_KEY_ID, RECOVERY_R2_READONLY_SECRET_ACCESS_KEY with a bucket-scoped Cloudflare R2 identity limited to GET/list (no PUT/DELETE), and RECOVERY_DB_BACKUP_ENCRYPTION_KEY from approved off-GitHub escrow.
- These new environment secrets are NOT created by the PR and are NOT available to PR CI. A job that runs without them should **fail**, not fall back to any production environment.
- Do not enable any scheduled jobs, copy live customer files, configure outbound notification credentials, or change GitHub backup schedules.

**CI:** scripts/backup/test_managed_recovery_preflight.py exercises valid direct/session URLs and rejects production project ref, unknown hosts, transaction-pooler ports, unsafe TLS, unknown query options and missing password. Verify R2 backup code static workflow checks the new workflow is only manual, env-isolated, R2 GET-based and read-only. Existing web checks remain required. Running PR CI uses **synthetic values only**.

## R1 extended PostgreSQL catalog inventory — read-only, 14 November 2026

A second live metadata-only SQL comparison (separate authorized Supabase account for each project) expanded the earlier column-only work. These are **live-catalog observations, not the selected encrypted archive's TOC**:

| Object family | Source `public` | Target `public` | Compatibility follow-up |
|---|---:|---:|---|
| Tables | 182 | 0 | Restore every archived application table (exact archive snapshot) |
| Views | 4 | 0 | Recreate underlying dependencies/security_invoker behavior |
| Indexes | 667 | 0 | Restore complete definitions/constraints |
| Sequences | 18 | 0 | Preserve start/current values and ownership |
| RLS-enabled tables | 182 | 0 | Preserve RLS after import |
| RLS policies | 252 | 0 | Owner/role predicate parity and negative tests |
| Functions | 446 | 1 | 392 application source SECURITY DEFINER functions; owner/execute ACL audit required |
| Enabled non-internal triggers | 166 | 0 | Restore and verify trigger effects |
| Foreign keys | 426 | 0 | Strict FK validation, no blanket disable |
| Check constraints | 356 | 0 | Strict constraint validation |

| Managed object family | Source | Target | Required reviewed action |
|---|---:|---:|---|
| `auth` tables | 27 | 27 | Same seeded table count, but not complete semantic parity |
| `auth` enabled non-internal triggers | **1** | **0** | Source has `on_auth_user_created` on `auth.users` calling `handle_new_user()`; ensure approved function/trigger semantics after restore; do not automatically run real-user side effects |
| `storage` tables | 10 | 10 | Pre-seeded table shape matches; do not overwrite/destroy it |
| `storage` RLS policies | **35** | **0** | Source policy operations: SELECT 13, INSERT 10, UPDATE 3, DELETE 7, ALL 2. Target policy restoration must be reviewed separately and tested; zero target policies does not itself prove public access |
| `storage` enabled non-internal triggers | 11 | 11 | Compare definitions, owner and behavior; same counts alone insufficient |
| `realtime` tables | **11** | **3** | Dated partition count drifted since earlier observation; never blindly replay managed partitions |
| `vault` tables and views | 1 + 1 | 1 + 1 | Key/extension compatibility and encrypted payload ownership need review |
| `supabase_migrations` tables | 1 | 0 | SQL migration history requires special handling |

The preflight TOC reader now emits only **aggregate** counts for relevant schema families: tables/data, views, indexes, constraints, FKs, functions, triggers, sequences, policies, grants/default ACLs, extensions and others. It does NOT issue a write or print object identifiers. The exact V2 archive TOC is the authority when that protected R1 workflow is executed. In particular, the `auth.users` trigger and Storage's 35 policies cannot be dismissed simply because the seeded target has the same table columns.

## Approved scope refinement — 14 November 2026

The user clarified the **primary drill objective is FULL PostgreSQL schema and SQL/database restoration**, not full production document migration. Recovery Storage file content will be tested with a **strictly bounded 500 MB decimal sample**, not the original ~1.73 GB corpus. This changes the exercise's file scope, **not** the database completeness requirement or privacy/security prerequisites.

### PostgreSQL/database success criteria (unchanged, complete)

- Restore/reconcile the selected consistent v2 `database.dump` snapshot's application-owned table definitions **and every table-data COPY destination**; compare exact snapshot-based row counts (do not substitute newer live source counts for archived counts). Include schema, table data, materialized views/views, constraints/indexes/FKs, sequences and values, functions, triggers, RLS policies, grants, default grants, owner/role relationships, types and supported extensions.
- Preserve and reconstruct required managed Auth/Storage/Realtime/Vault/migration history semantics **through reviewed Supabase-compatible procedures** rather than deleting or overwriting platform-managed schemas. This is a completeness requirement: if any SQL family, archived data table, role/owner, trigger/function, Vault dependent data or managed Auth data cannot be migrated, mark **MANAGED DATABASE RESTORE PARTIAL** even if application `public` tables pass.
- Measure parity and negative authorization tests against the same archive. The source and target PG17 minor releases differ; do not silently assume managed platform versions and extensions match. Run newest v2 full archive in disposable PG17 first (R3), then only reviewed batches on managed target after the independent security decision.

### Strict two-track SQL fidelity rule (avoids orphaned managed Storage records)

**Track A — complete SQL archive replay in disposable PG17 (R3):** replay the **entire** exact v2 custom-format archive, including the source's `storage.objects` *SQL metadata*, and validate every archived COPY target, count, schema object, ACL and role/owner caveat in a network-disabled non-service database. This proves backup completeness independently of real file bytes.

**Track B — managed Supabase recovery project (R4–R6):** restore/reconcile **all application/business SQL tables and their data**, compatible functions, RLS, roles, Auth and required service dependencies. Preserve the managed target's Storage schema. For the deliberately limited 500 MB real-file trial, use the **Storage API** to create only the selected recovered objects and their matching Storage metadata. Do **not** insert all source `storage.objects` rows when most file bytes are absent; that causes inaccessible/orphaned document references and can violate Storage service invariants. Log the intentional count difference as `STORAGE_METADATA_PARTIAL_BY_DESIGN`, while retaining full original SQL metadata parity evidence from Track A.

This means **complete SQL archive restorable = potentially PASS**, **managed target complete live Storage metadata/file recovery = NOT TESTED**, and **managed database/app SQL and Auth permission parity = separately graded**. The project does not receive a `DATABASE_FULL_SQL_PARITY` label that pretends missing actual documents work. This was resolved in the test matrix without making unsafe production or managed target writes.

### Storage file sample plan (500 MB hard cap)

1. Use only an **authenticated encrypted Storage R2 manifest** and its corresponding immutable blobs. Select deterministically across as many populated buckets as possible, PDF/image/office/video classes and small/medium/large size bands. One single file **MUST NOT exceed 50,000,000 bytes** because the recovery project is on Free tier; the **total selected file bytes MUST NOT exceed 500,000,000 bytes**. Print aggregate counts, categories and bytes; **never** filenames, source document paths, policy numbers or R2 keys. Files larger than the per-file cap are **excluded and counted as out-of-scope**, not silently treated as restored.
2. New private tool `scripts/backup/plan_recovery_storage_sample.py --plan` reads ONLY the R2 encrypted manifest and computes an aggregate plan (no blob download). `--verify` additionally reads/decrypts and SHA256/size-checks ONLY the chosen file bytes **in memory**, still no Supabase target writes. Protected workflow input `verify_storage_sample_bytes` defaults false. The actual sample transfer is **not included** in this PR.
3. At R6 after privacy/quota authorization, use recovery-only Supabase **Storage API/S3** to create restricted test buckets and upload the selected subset with the original MIME and immutable expected hash, then download through an isolated authorized test principal to verify SHA256, MIME, list/private status, signed URL expiry, and rejected unauthorized download. Avoid real OTP/email/webhooks and keep test-only credentials off production. Any API upload writes `storage.objects` metadata through Storage service. **Do not directly INSERT/UPDATE/DELETE `storage.objects` to fake file recovery.**
4. Reconcile SQL metadata separately. The SQL archive may contain **all** historical `storage.objects` rows, while only a fraction of associated file bytes is restored. If the managed Storage service cannot safely accept those old rows, do not overwrite its pre-seeded managed schema: document the source metadata row count, selected sample row count and non-restored file count explicitly. Do not mislabel missing bytes as working documents. Partial file recovery is a valid **sample test** but it cannot close the DR plan's full Storage service certification gate.
5. Verify Free-tier actual balance and billing lockout. Published plan limits are 500 MB SQL database, 1 GB Storage and maximum 50 MB **per file**, but actual project usage, organizational pooled Storage allowance and project availability are still to be confirmed. **No plan upgrade or live customer-document transfer without separate operator/security authorization.**

**Evidence labels:** `DATABASE_FULL_SQL_PARITY` only after strict exact-snapshot managed SQL and role/RLS/managed-service verification, `STORAGE_500MB_SAMPLE_PASS` only after actual isolated recovery Storage upload/download tests, `FULL_DOCUMENT_RESTORE=NOT_TESTED`, `FULL_SERVICE_DR=NOT_CERTIFIED`. A successful R2-only hash verifier is **not** a Storage service recovery pass.

## Later stages — NOT approved by this PR

R2 will require a separate reviewed target-changing workflow design and exact TOC allowlist. R3 must validate the latest archive in a disposable PG17 version-compatible environment. R4 managed target import needs **separate explicit written approval of exact archive, approved data families, owner/roles strategy, network/privacy, capacity and rollback plan**. Do not use global pg_restore --clean, drop managed Auth/Storage/Vault, disable RLS for convenience, grant superuser/BYPASSRLS to app users, or copy platform root/signing secrets. Skipped managed data means PARTIAL restoration, never certified service recovery. R5–R8 cover actual row/owner/permission equivalence, isolated Auth/Storage files/Edge Functions, app test, RPO/RTO and independent signoff.

## Status / evidence hygiene

- Reviewable preflight PR: pending actual URL/CI run. **No protected preflight dispatched; no archive restored.**
- Actual output for R2 snapshot, TOC counts and missing managed dependencies must be added only after the protected manual job passes, with its real run link.
- Update the existing authoritative handoff's top section and issue #4264 after validated milestones. Keep old run links and time-specific counts without replacing them with a different snapshot's figures.
- No writes to production ilzhsfqqjyppzzvfscmh, no writes to recovery target klnodxnmlqbofolxxrsr, no R2 deletion/upload or mobile/web release during this preflight preparation.
