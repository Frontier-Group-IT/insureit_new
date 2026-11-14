# INSUREIT — R4 managed-target SQL restoration execution runbook

**Updated 14 Nov 2026 IST. Status: PREPARED, NOT EXECUTED.** Primary operator request: actually restore the SQL schema and data from encrypted R2 v2 into **only** the isolated managed Supabase project. File-byte trial limited to 500,000,000 bytes total, maximum 50,000,000 bytes per file. Never switch production apps or mutate production.

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

## Ownership discovery at target — verified and binding

A fresh SELECT-only target privilege audit found **postgres is NOT superuser**, is **not a member** of `supabase_auth_admin` or `supabase_storage_admin`, and cannot `SET ROLE` to either managed owner. It **does have INSERT privilege** on `auth.users` and `auth.identities`. Consequently, the first R4 workflow can import compatible Auth **data** but **MUST NOT** execute source `CREATE TRIGGER` on `auth.users` or `CREATE POLICY` on `storage.objects`/`storage.buckets`: these require managed table ownership. It now fails closed on attempts to include those entries.

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
