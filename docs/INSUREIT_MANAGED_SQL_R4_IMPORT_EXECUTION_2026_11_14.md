# INSUREIT — R4 managed-target SQL restoration execution runbook

**Updated 14 Nov 2026 IST. Status: PREPARED, NOT EXECUTED.** Primary operator request: actually restore the SQL schema and data from encrypted R2 v2 into **only** the isolated managed Supabase project. File-byte trial limited to 500,000,000 bytes total, maximum 50,000,000 bytes per file. Never switch production apps or mutate production.

## 17 Nov 2026 — first real isolated R4 import stopped on managed Auth FK; safe rollback verified

**Observed:** [Protected GitHub R4 apply run #44035238446](https://github.com/Frontier-Group-IT/insureit_new/actions/runs/44035238446) passed strict target URL, isolated CA `verify-full`, latest authenticated R2 snapshot `20261117T041507Z`, private TOC validation, selected 2,602 restore entries (183 public app TABLE + TABLE DATA, 26 managed Auth TABLE DATA) and no-write plan. The `ATOMIC SQL RESTORE` step then failed, and post-restore audit was skipped.

**Root cause proven independently from isolated target PostgreSQL logs:** at 2026-11-17 07:01:33 UTC, PostgreSQL returned SQLSTATE **23503 (foreign_key_violation)** on `COPY auth.identities`. The `identities_user_id_fkey` foreign key requires `auth.users` parent records, which the source archive's selected TOC copy order had not yet restored. Supabase's pre-existing Auth service schema enforces the foreign key during COPY; the complete R3 offline replay installs Auth constraints after data and therefore did not expose this ordering difference. **The failure is not source corruption**: read-only source query confirmed 87 `auth.users`, 91 `auth.identities`, and **0 orphan identities**.

**Rollback independently checked after failure:** target public application tables **0**, `auth.users` **0**, `auth.identities` **0**, Storage buckets/objects **0**, public RLS policies **0**, restored custom application schemas **0**. The target database's size increased slightly due to the rolled-back attempt; do not interpret that storage footprint as restored rows. No source/production database writes or application deployments were made. Never retry the same apply unchanged.

**Narrow corrective PR (not merged until separate approval):** select the isolated target's enforced `auth` FK graph by **READ ONLY** `pg_catalog.pg_constraint` query over `verify-full` TLS, verify the known baseline (24 Auth FKs including `identities → users`), then topologically order only selected `auth.TABLE DATA` TOC items before the first application COPY item. PostgreSQL 17 `pg_restore --use-list` explicitly restores in list-file order. Load parents (`auth.users`, `auth.sessions`, `auth.oauth_clients`, `auth.mfa_factors`, etc.) before dependents. Fail closed if a selected child's parent is absent, dependencies cycle or self-reference, or the target FK baseline changes; **never disable constraints, suppress errors, relax RLS/TLS/URL controls, or drop/overwrite tables**. All other approved schema/data entries keep their relative order. Only aggregate counts / flags are logged. Future psql apply failures can emit the five-character PostgreSQL SQLSTATE only, keeping the private SQL and row details concealed.

**Scope / next steps:** R4 remains a *partial* application SQL and compatible managed Auth rows import, not full Supabase service/role/ACL/Storage certification. After PR review and required GitHub CI, separately approve merge; reverify target is still empty and snapshot is still latest (rerun matched R1/R3 if advanced), run a fresh **R4 dry-run with `execute_target_import=false`** and verify `R4 AUTH FK COPY ORDER VERIFIED: ... users_before_identities=1 no_fk_disable=1`. Only after reviewing this evidence and re-authorizing should an isolated target apply be attempted. If the apply fails, check target state and SQLSTATE before any further retry.

## 17 Nov 2026 — R4 unrecognized PostgreSQL TOC descriptor, read-only recovery remains safe

[Protected R4 dry-run #44028964026](https://github.com/Frontier-Group-IT/insureit_new/actions/runs/44028964026) authenticated the exact encrypted R2 v2 snapshot `20261117T041507Z`, passed isolated project URL allowlist, CA `verify-full` read-only target and verified an empty destination, and audited the private TOC and catalog. The R4 allowlist parser stopped **before its dry-run plan** with fixed `failure_code=UNRECOGNIZED_TOC_RECORD`. No managed SQL was imported, no source database was connected to or modified.

PostgreSQL 17 `pg_dump` explicitly emits `CHECK CONSTRAINT` TOC descriptors for separately dumped table and domain CHECK constraints (see [upstream PostgreSQL 17 dump implementation](https://github.com/postgres/postgres/blob/REL_17_STABLE/src/bin/pg_dump/pg_dump.c)); the current selector lists `CONSTRAINT` and `FK CONSTRAINT` but **omits `CHECK CONSTRAINT`**, a valid application schema dependency. The exact private rejected entry cannot be confirmed because customer-related archive object identifiers are intentionally not logged. This is a documented real descriptor gap and a strong candidate, **not proof** of the specific entry.

Proposed narrow parser fix: add `CHECK CONSTRAINT` to application object selection, while managed Auth, Storage and `pg_catalog` check constraints remain explicitly excluded. Recognize `BLOB METADATA` as PostgreSQL-standard metadata but defer it (no large object restore from R4). Keep every unknown descriptor rejected. Improve future sanitized errors to distinguish **`UNKNOWN_TOC_DESCRIPTOR`** from **`INVALID_TOC_FIELDS`** or **`INVALID_TOC_SHAPE`**, never logging raw private TOC lines or customer identifiers. Synthetic tests verify application constraints are selected, managed/system ones are excluded, public/Auth coverage constraints remain and invalid/unknown lines fail closed.

Do not change snapshot freshness gate, isolated Supabase URL/CA protections, target empty requirement, default `execute_target_import=false`, or managed-role/Storage exclusions. After related GitHub CI and separately authorized merge, manually rerun **R4 dry-run only** on the last R1/R3 verified snapshot **if still the latest**, and inspect resulting plan/failure codes before independently authorizing any SQL import. Full Supabase services, original ownership/ACL/RLS security parity and ≤500MB sampled Storage bytes still require separate recovery work.

## 17 Nov 2026 — R4 unknown archive namespace, fail-closed follow-up

[Protected R4 dry-run #44026859831](https://github.com/Frontier-Group-IT/insureit_new/actions/runs/44026859831) authenticated exactly `20261117T041507Z`, passed destination URL guard, isolated Supabase CA `verify-full` TLS, empty target, PostgreSQL archive inspection and read-only catalog parity checks, but failed at the strict TOC selector with sanitized `failure_code=UNKNOWN_ARCHIVE_NAMESPACE`. No R4 planned-SQL output, and **no database import or production write occurred**.

The source Supabase `pg_namespace` catalog was inspected using **SELECT only**. The set of existing source namespaces omitted by the R4 explicit allowlist consisted of **two PostgreSQL built-ins, `pg_catalog` and `information_schema`**, in addition to internal `pg_toast*`/`pg_temp*` namespaces excluded from the inventory. These two names are safe to *recognize* as standard PostgreSQL metadata namespaces but must **never be selected into application/managed Auth SQL**. Because the job deliberately redacts private TOC names, the specific offending TOC namespace was not directly observable; the two built-ins are the narrowed, not yet conclusively proven, diagnosis.

Fix PR (separately reviewed, unmerged at authoring) adds `DEFERRED_SYSTEM_SCHEMAS = {"pg_catalog", "information_schema"}` to TOC namespace validation, plus an **independent explicit never-select guard**. Regression tests exercise TABLE, TABLE DATA, FUNCTION, POLICY and ACL records in both built-in namespaces: they must not enter the target restore list. Unknown custom schemas and prefix lookalikes (e.g. `pg_catalog_copy` or `information_schema2`) still fail closed with only a fixed non-sensitive error code.

Do not broaden to all `pg_*` namespaces or assume arbitrary TOC entries are compatible. No change to schema/data minimums, managed Storage/Auth exclusions, target allowlist, snapshot lock, CA verification, or default `execute_target_import=false`. After PR CI and explicit merge approval, rerun **R4 dry-run only** against the latest matched R1/R3-verified snapshot; inspect any new failure category, preserving private TOC/credentials. Actual target import remains separately gated and does not establish Supabase service/Storage/role parity.

## 17 Nov 2026 — R4 strict TOC parser incompatibility, no import performed

- **Authenticated current snapshot:** `20261117T041507Z`. [R0/R1 preflight #44022681111](https://github.com/Frontier-Group-IT/insureit_new/actions/runs/44022681111) and [R3 offline full replay #44023136022](https://github.com/Frontier-Group-IT/insureit_new/actions/runs/44023136022) both passed this same exact snapshot; R3 verified 233/233 archived COPY tables with zero row-count differences, strict data/ACL replay with two placeholder offline roles.
- [Manual protected R4 dry-run #44023706486](https://github.com/Frontier-Group-IT/insureit_new/actions/runs/44023706486) fetched/authenticated the archive and successfully checked isolated project CA TLS, target URL and empty target. It stopped **before planning or any import** at `prepare_managed_sql_restore_list.py` with a redacted `ValueError`; no target SQL writes occurred.
- Source inspection identified a definite PostgreSQL 17 TOC parser incompatibility: `pg_dump` always emits special `ENCODING`, `STDSTRINGS`, and `SEARCHPATH` records before other TOC objects; the old R4 selector rejects unrecognized record types. Public PostgreSQL source: https://doxygen.postgresql.org/pg__dump_8c.html and sample 17 `pg_restore --list` output. Private raw TOC was intentionally not exposed in logs. The new parser explicitly recognizes these known PostgreSQL metadata types (plus other documented, **deferred** PG17 descriptors), does not add them to selected application SQL, and continues to reject unknown types and schemas. Regression fixtures reproduce the PG17 header and prove no new managed objects are selected.
- **Safety:** this is a parser-only workflow code PR; no bypass of the snapshot lock, target allowlist, CA verification, pristine destination requirement, partial Auth/Storage restrictions, `execute_target_import=false` default, or GitHub protected environment. The next review gate after PR CI/merge is **manual R4 DRY RUN again** against the same snapshot if still latest, or a new R1/R3 matched pair after pointer drift. Never check `execute_target_import` until a successful dry-run is reviewed and target changes separately approved.

## 16 Nov 2026 update — exact matched snapshot R1 + R3 passed; R4 remains DRY-RUN FIRST

**Evidence observed in authenticated GitHub Actions logs, not inferred from screenshots:**

- [R0/R1 managed read-only preflight #43821883370](https://github.com/Frontier-Group-IT/insureit_new/actions/runs/43821883370): passed destination allowlist, isolated project CA `verify-full` TLS, truly READ ONLY transaction and pristine target. Authenticated encrypted archive `snapshot=20261116T012747Z`, 234 TOC TABLE entries, 233 COPY destinations, 287 policies, 20 sequences. Target had 0 application tables, 0 Auth users, 0 Storage objects.
- [R3 full offline SQL restore #43822495428](https://github.com/Frontier-Group-IT/insureit_new/actions/runs/43822495428): **same exact snapshot** `20261116T012747Z`. Network-disabled disposable PostgreSQL replay: 233/233 archived COPY targets verified, 0 data mismatches; strict application+managed DDL, data and ACL replay passed with 2 offline NOLOGIN source-role-name placeholders; original role owner/membership/login semantics NOT verified. Offline database was destroyed.
- The recovered archive contains 183 public application table definitions and 48 managed table definitions (plus 2 dependency TABLE records); 35 managed Storage RLS policies and an Auth trigger are still absent from the clean managed destination. Different 14 Nov archive counts in older notes below refer to earlier snapshot and must not be treated as matching evidence.

**Main branch reconciliation:** this updated R4 PR branch is built directly on current main rather than the earlier stacked R0/R1 branch. It inherits the proven protected `RECOVERY_DB_SSL_ROOT_CERT_PEM` implementation. An early R4 read-only target TLS probe now runs BEFORE any R2 retrieval; all later target read-only catalog checks, selected-row auditing and Docker `psql --single-transaction` apply path use only the isolated project's downloaded CA under `verify-full`, never unauthenticated TLS or production credentials.

**First run remains non-mutating:** on `main`, after separately approved merge of this branch and verification of GitHub protected environment reviewers/branch restrictions, trigger the R4 workflow with:
`expected_db_snapshot=20261116T012747Z`, `confirm_target_ref=klnodxnmlqbofolxxrsr`, `confirm_isolation=true` only after reviewing isolation, and **`execute_target_import=false`**. A changed R2 latest-pointer stops this workflow until a new R1/R3 pair is run; never relax timestamp pinning. This R4 dry-run does NOT restore customer rows.

**Actual target write is a separate go/no-go.** R4's selected TOC includes all application-schema data and compatible managed Auth table data, but excludes managed Storage file/metadata, Auth schema migration history, source Storage policies (35), Auth custom trigger, Realtime/Vault system state, and original role owners/ACL. Even after selected R4 import, full SQL semantic parity, functional Supabase Auth/Storage, network isolation, privacy retention, and complete DR certification remain OPEN. Do not connect live production applications to this target or describe selected import as a complete restoration.

## Locked identities and evidence

| | Source backup origin / PRODUCTION (READ-ONLY) | Managed destination (TARGET WRITES ONLY) |
|---|---|---|
| Supabase ref | ilzhsfqqjyppzzvfscmh | klnodxnmlqbofolxxrsr |
| Project | Insureit_Web | INSUREIT_VAPT_ISOLATED |
| Organization | Insureit Pro Plan | Sankalp (Free, separate account) |
| PG17 version | 17.6.1.164 | 17.11.0.019 |

Successful encrypted R2 v2 [network-disabled manual R3 job #43567559473](https://github.com/Frontier-Group-IT/insureit_new/actions/runs/43567559473): **233 table definitions, 232/232 COPY target row-count parity, 287 RLS policies, 20 sequences, 0 missing data**, strict ACL replay with **2 offline role placeholders / --no-owner**. This did not import into managed target and did not log immutable archive timestamp.

**Real isolated-target changes already applied this turn via connected Supabase migration tools:**
1. Enabled source-compatible **pg_trgm 1.6** and **hypopg 1.4.1** in \`extensions\` schema. Verified versions.
2. Revoked direct PUBLIC/anon/authenticated EXECUTE on Supabase's preinstalled public SECURITY DEFINER \`rls_auto_enable()\`, retaining \`postgres\` owner EXECUTE and enabled event trigger. Supabase target Security Advisors returned **no findings** immediately afterwards.

No business data, auth users or actual document file contents have been imported as of this checkpoint.

## Supported SQL execution path probe — target only (14 Nov 2026)

The owner/membership catalog alone did **not** settle managed custom DDL capability. On the *empty isolated target*, two rollback-safe ephemeral tests run through the connected Supabase SQL execution path as `postgres` **SUCCEEDED**: (1) create, verify and drop a temporary restrictive SELECT policy on `storage.objects`; (2) create a no-op trigger function, create/verify/drop a temporary trigger on `auth.users`, then drop its function. Independent SELECT confirmed **zero probe objects persisted**. No source DB SQL write or customer data import occurred.

**Corrected interpretation:** Supported Supabase SQL execution can create these owner-managed customizations even though the catalog shows `postgres` is not a member of the managed owner roles. The separately hosted **GitHub Actions direct psql connection has NOT yet been privilege-probed**, and the actual source policy SQL/function behavior has NOT been imported/tested. The first R4 workflow safely defers these items until a separate approved SQL-editor/supported-path restoration stage following application SQL import; they are **NOT permanently impossible**. Do not escalate, `SET ROLE`, rewrite owners or modify the live project to bypass checks.

## Ownership discovery at target — verified and binding

A fresh SELECT-only target privilege audit found **postgres is NOT superuser**, is **not a member** of `supabase_auth_admin` or `supabase_storage_admin`, and cannot `SET ROLE` to either managed owner. It **does have INSERT privilege** on `auth.users` and `auth.identities`. Consequently, the first R4 workflow can import compatible Auth **data** but **MUST NOT** execute source `CREATE TRIGGER` on `auth.users` or `CREATE POLICY` on `storage.objects`/`storage.buckets`: these need an independently verified supported managed-Supabase SQL execution route. It now fails closed on attempts to include those entries.

This means the first actual target import is necessarily **PARTIAL managed service SQL restore**, even when application tables/rows are complete. A **separate Supabase-supported managed-owner migration or privileged platform procedure** is needed to reconstruct one source Auth trigger and 35 source Storage policies. Never grant superuser/BYPASSRLS or impersonate managed roles to force completion. Do not connect live clients to this unfinished service.

**Additional Auth DML ownership check:** `postgres` has INSERT permission on **26 of 27 target auth tables**; the sole exception is `auth.schema_migrations` (platform-managed version history). R4's private TOC filter now excludes `auth.schema_migrations` from target imports and from selected COPY parity checks. Original Auth version history is **DEFERRED** to a Supabase-supported managed migration process, not silently described as restored. This restriction is separate from the source `supabase_migrations.schema_migrations` history, which is also deferred.

## Dependencies and mandatory human-operated trust boundary

- Review/merge [R0/R1 preflight PR #4433](https://github.com/Frontier-Group-IT/insureit_new/pull/4433) after its required checks, preserving no app/deployment changes. This makes \`insureit-managed-recovery-preflight.yml\` available on main.
- Review/merge **this stacked R4 PR #4487** after checks and merged base. Its workflow is \`.github/workflows/insureit-managed-recovery-import-r4.yml\`. A merged workflow is **manual only** and does NOT import automatically.
- Configure GitHub environment **\`insureit-recovery-isolated\`** in repo Settings → Environments, with **required human reviewer and main-only branch restriction**. Verify approval is truly enforced before any decrypted R2 archive is used.
- Provide the following environment secrets **only in GitHub protected environment**; NEVER paste into chat/PR/log:
  - \`INSUREIT_RECOVERY_DATABASE_URL\`: only target \`klnodxnmlqbofolxxrsr\`, direct db host or session pooler with project ref username, port 5432. No source/prod credentials.
  - \`RECOVERY_R2_ACCOUNT_ID\`, \`RECOVERY_R2_READONLY_ACCESS_KEY_ID\`, \`RECOVERY_R2_READONLY_SECRET_ACCESS_KEY\`: bucket-scoped immutable **R2 GET/LIST only**, no PUT/DELETE.
  - \`RECOVERY_DB_BACKUP_ENCRYPTION_KEY\`: DB v2 AES key from approved escrow, not Storage key.
- **Important:** This ChatGPT GitHub connection provides repository/PR/CI editing and viewing but no workflow dispatch or GitHub environment secret provisioning. Do not claim any protected workflow has been run until its actual run URL exists.

## Read-only R1 and manual first import sequence

1. Verify project in [isolated Supabase dashboard](https://supabase.com/dashboard/project/klnodxnmlqbofolxxrsr): no unrelated users/projects/clients, restricted member access, no live Auth SMTP/OAuth/SMS/email, no live outbound calls, and no production Cloudflare/Expo app pointing here. Confirm Free quota/grace allows SQL and later 500 MB Storage test, and that real customer-record cloning is permitted under the project security/retention policy.
2. On main, manually launch \`INSUREIT isolated managed recovery R0-R1 preflight\` with \`expected_db_snapshot\` blank, optional Storage sample inputs false. It validates target URL before R2 GET, prints the authenticated **snapshot=YYYYMMDDTHHMMSSZ** of the latest v2 archive and private TOC aggregate. No import.
3. Record the exact observed snapshot. On main, manually launch \`INSUREIT isolated MANAGED SQL import R4\` with \`expected_db_snapshot\` set to that timestamp, \`confirm_target_ref=klnodxnmlqbofolxxrsr\`, \`confirm_isolation=true\`, **\`execute_target_import=false\`**. Review its private TOC selection counts and target-empty safeguards. If R2 latest changed, STOP and repeat R1; never alter pointer to force match.
4. Review R4 application/table/Auth/Storage policy allowlist against the **actual snapshot**. The verified 14 Nov live source baseline was 182 public tables, 27 Auth tables (Auth COPY targets depend on snapshot), 35 Storage RLS policies, one \`auth.users.on_auth_user_created\` trigger, two private app schemas with tables (\`identity_maintenance\`, \`insureit_recovery\`). The workflow refuses unrecognized archive schemas/TOC item types and replays no managed table DDL.
5. Only after operator/security review, rerun the same R4 workflow with \`execute_target_import=true\`. It selects application-owned public and private SQL objects, compatible existing-schema Auth table data, application-owned schema objects and Auth table data; owner-only Auth trigger and Storage RLS policies are deferred. It deliberately **does not import** all historic \`storage.objects\`/bucket SQL records into managed target because most file bytes are out of the ≤500MB sample scope.
6. The runner first renders a private, filtered SQL script in a **network-disabled container**. It executes filtered SQL and **REVOKE of public/anon/authenticated grants + RLS/Auth/policy/security-definer checks in the SAME psql transaction**. Any SQL or security failure is intended to abort/roll back the whole import. All confidential decrypted dump, row SQL, private SQL and logs are removed from the ephemeral runner in an \`always()\` step.
7. After successful atomic import, a READ ONLY row audit compares all selected archived COPY destinations' per-table counts on isolated target; confirms public table RLS, managed Storage policies and Auth trigger. It does not send original row content to GitHub logs.

### Explicit limits after a successful selected R4

This establishes **selected app/compatible Auth schema + row data import**, not original source role owner/membership/ACL reconstruction (the first managed import uses \`--no-owner\` and \`--no-acl\`), Vault root-key/secret recovery, Realtime partition/service recovery, missing full Storage object SQL metadata, or file-byte serving. An additional security-grant audit and service configuration are required **before any app/client connects to the target**. The initial R4 deliberately revokes broad public/anon/authenticated access to imported tables/functions for confidentiality. This may make anonymous or authenticated app APIs nonfunctional until reviewed selective RBAC grants are reconstructed.

A failed R4 with atomic SQL rollback should leave the target in its pre-import state. A post-commit row audit error is a **FAILED/INCONCLUSIVE** gate: never automatically \`DROP\`, \`TRUNCATE\` or purge the recovered customer data; restrict access, inspect private diagnostics through a controlled review, and plan a separately approved correction.

### Later 500 MB Storage API exercise (NOT part of R4)

Only after the SQL/managed storage policies are verified, read the authenticated encrypted Storage manifest, deterministically select representative source files within 500,000,000 total bytes and 50,000,000 single-file size, upload via the **isolated target Storage API** (not direct \`storage.objects\` SQL), verify SHA256/MIME, private listing, signed URL expiration and unauthorized denial. Both full Storage dataset (~1.73 GB historically) and full document/metadata parity remain **NOT TESTED**. Free storage quota/cost and security authorization are mandatory.

## Current certification labels

- \`OFFLINE_FULL_SQL_ARCHIVE_RESTORE=PASS\` (run #43567559473, 232/232).
- \`TARGET_EXTENSION_PARITY=PARTIAL\` (matching pg_trgm/hypopg installed, index_advisor/Vault differs).
- \`TARGET_PRESEED_SECURITY_HELPER=LOCKED\` (advisor clear at last check).
- \`R1_TARGET_ENCRYPTED_TOC_PREFLIGHT=NOT_RUN\`.
- \`R4_MANAGED_TARGET_SQL_IMPORT=NOT_RUN\`.
- \`R6_STORAGE_500MB_API_FILES=NOT_RUN\`.
- \`FULL_INSUREIT_DR_CERTIFIED=NO\`.

**This is an operational runbook, not a claim of completed recovery.**
