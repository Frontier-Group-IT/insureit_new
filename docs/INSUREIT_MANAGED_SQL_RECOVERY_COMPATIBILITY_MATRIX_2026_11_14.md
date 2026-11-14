# INSUREIT full SQL recovery — R1 read-only managed-schema compatibility matrix

**Checkpoint:** 14 November 2026 IST. **Target:** INSUREIT_VAPT_ISOLATED / klnodxnmlqbofolxxrsr. **Production source:** Insureit_Web / ilzhsfqqjyppzzvfscmh. **Inspection:** SELECT-only through distinct connected Supabase accounts; **no target or production writes, no encrypted R2 TOC opened**. This is a live-catalog comparison, NOT an archive-snapshot comparison. It supplements the [original dated handoff](INSUREIT_SUPABASE_R2_STORAGE_BACKUP_HANDOFF_2026_10_31.md), the [R0/R1 safety plan](INSUREIT_MANAGED_RECOVERY_READONLY_PREFLIGHT_2026_11_14.md) and [issue #4264](https://github.com/Frontier-Group-IT/insureit_new/issues/4264).

## Scope adopted from user (SQL-full, files sampled)

The success target is **complete PostgreSQL schema and SQL/data replay** of a single authenticated encrypted R2 v2 archive, all its COPY targets, permitted extensions, grants/ownership, Auth, RLS and functions/triggers. Full archive SQL replay must first be proven in a disposable offline PG17. Live managed service recovery requires compatible, reviewed migration of relevant Auth/Storage/Realtime/Vault SQL plus actual application data; no blanket pg_restore --clean.

The separate Storage API test is intentionally limited to **500,000,000 file-content bytes combined**, maximum **50,000,000 bytes for each sampled file**, covering representative buckets and file formats. Source complete Storage SQL metadata can be replayed into disposable PG17 for archive fidelity but **must NOT be inserted wholesale into the managed target** if associated file bytes are intentionally not restored; that creates orphaned/unavailable documents. Only the sampled files are uploaded through the recovery Storage API after authorized security/quota signoff. Full-document recovery remains NOT TESTED.

## Verified SQL definition parity by *matching object identity*

Fingerprints for function, index and constraint *definitions* were computed inside each database using pg_catalog metadata, then compared privately by schema + object identity. The definitions and secret-bearing source code were NOT copied into the PR, output or chat. Owners and PostgreSQL role catalog metadata were compared directly (no passwords, no row contents).

| Managed family | Exact matching identities and definitions / common objects | Source only | Differences requiring review |
|---|---|---|---|
| **Auth functions** | 4 / 4 | 0 | No shared definition drift |
| **Auth indexes** | 111 / 111 | 0 | No shared definition drift |
| **Auth constraints** | 110 / 110 | 0 | No shared definition drift |
| **Auth relation owners** | 28 / 28 | 0 | No shared owner drift |
| **Auth user triggers** | 0 shared | **1** | Source \`on_auth_user_created\` on \`auth.users\` calls \`handle_new_user()\`; target lacks trigger. Review side effects before recreation |
| **Storage functions** | 24 / 24 | 0 | No shared definition drift |
| **Storage indexes** | 26 / 26 | 0 | No shared definition drift |
| **Storage constraints** | 26 / 26 | 0 | No shared definition drift |
| **Storage triggers** | 11 / 11 | 0 | No shared definition drift |
| **Storage owners** | 10 / 10 | 0 | No shared owner drift |
| **Storage RLS policies** | Target has **0** | **35** | Source 13 SELECT, 10 INSERT, 3 UPDATE, 7 DELETE, 2 ALL. Critical to authorization. Reconstruct only following reviewed role and bucket access model; test negative reads |
| **Vault functions** | **3 / 5** shared match | 0 | **2 shared definitions differ:** \`vault.create_secret\`, \`vault.update_secret\`. Source supabase_vault 0.3.1, target 0.3.2; do not replace new managed Vault routines with older source DDL |
| **Vault indexes, constraints, relation owners** | 2 / 2 indexes; 1 / 1 constraint; 2 / 2 relations | 0 | No shared definition/owner drift |
| **Realtime functions** | 19 / 19 | 0 | No shared definition drift |
| **Realtime indexes and constraints** | 4 / 4 shared indexes, 5 / 5 shared constraints | **16 source-only indexes, 16 source-only constraints** | Source extra time-partitioned objects; omit/recreate only through supported managed Realtime lifecycle |
| **Realtime triggers and relation owners** | 1 / 1 trigger, 4 / 4 common owners | **8 source-only relation owners** | Dated partitions differ; never transplant platform-managed partitions wholesale |

**Clarification:** a matching definition fingerprint for selected PostgreSQL objects proves structural equality for that catalog entry at inspection time, not permission equivalence, extension behavior, Auth HTTP/SMTP behavior, successful API access or historical archive snapshot parity.

### PostgreSQL roles

Current role catalog (excluding \`pg_*\`) has **16 source roles vs 15 target roles**. The missing name is \`cli_login_postgres\`; all **15 shared roles have matching compared role capability flags**, including superuser, login, bypass-RLS, create role/db, replication, inherit and connection-limit metadata. No actual role passwords or login tokens were read.

Total global \`pg_auth_members\` edges were previously **22 source vs 24 target**. The subset where *both* roles are not \`pg_*\` is **11 source vs 13 target**, with **10 exact shared membership edges**. Source-only: \`cli_login_postgres\` has a SET role membership in \`postgres\`. Target-only: \`supabase_realtime_admin\` has SET memberships in \`anon\`, \`authenticated\` and \`service_role\`. This difference is **platform-level** and must be reviewed, not 'fixed' by granting privileges or creating live login accounts.

### Application/public schema

Source has **182** public tables, **4** views, **18** sequences, **667** indexes, **252** RLS policies (182/182 public tables RLS enabled), **446** functions (**392** SECURITY DEFINER), **166** enabled noninternal triggers, **426** foreign keys and **356** check constraints. The target's application-owned public tables/constraints/views/policies are empty; the one target public function is a preinstalled RLS event-trigger helper. These are **live metadata numbers**, not a snapshot result. No production business row or function source code was shared.

## R2/R3 exact v2 archive verification (not yet run for latest snapshot)

An earlier offline verified archive had **230/230** COPY targets. A newer successful scheduled v2 backup #43542747014 reported **233 table definitions / 232 COPY data targets**. This latest or a newer encrypted v2 manifest must be authenticated, decrypted privately and audited by \`pg_restore --list\` **for that actual snapshot**; never hardcode either historical count as the current restore truth.

1. **R2 protected read-only preflight:** [PR #4433](https://github.com/Frontier-Group-IT/insureit_new/pull/4433) provides \`.github/workflows/insureit-managed-recovery-preflight.yml\`. On reviewed \`main\`, set up GitHub environment \`insureit-recovery-isolated\` with main-only restrictions + required reviewer, target-only DB URL, bucket-scoped R2 GET/LIST credentials, **distinct** approved DB and Storage archive decryption secrets. Do not reuse the production application service key, source database password or production backup environment credentials. The workflow cannot execute a DB restore. Its `plan_storage_sample` and `verify_storage_sample_bytes` inputs both default false, so the SQL-focused preflight does not depend on Storage decryption keys.
2. **R3 disposable strict full restore (already on main):** run workflow \`.github/workflows/insureit-postgres-r2-v2-restore-verify.yml\` manually. It fetches/decrypts the **current R2 v2 latest pointer**, inspects the exact archive TOC privately, restores all selected archive schema/data/ACL to a \`--network none\` Supabase PG17 container and checks **every COPY row count**. Collect exact workflow run URL, snapshot TOC totals, any explicit ACL fallback and role-name-placeholder count. **Do not infer production owner/RLS parity from a --no-owner restore.** If the latest pointer changes between R2 and R3, label the runs as **different snapshots** unless an immutable manifest selection is implemented and verified.
3. **R3 managed-version compatibility:** after strict offline replay, assess target 17.11.0.019 vs source 17.6.1.164 extension/managed schema differences. Do NOT call an offline 17.6 image proof of managed 17.11 compatibility. If no independently tested target-version matched environment exists, this gate remains **OPEN**.
4. **R4 first real managed-target import:** independently review exact object TOC restore-matrix allowlist, role/owner/policy/trigger/Vault handling, PII access safeguards, Free quota and rollback. Operator must approve the specific target-only changing operation separately. **No managed DB import exists in PR #4433.**

### Stop/assurance labels

- \`R1_LIVE_CATALOG_COMPATIBILITY_REVIEW=PARTIAL\`: definition matches recorded, but no authenticated latest archive TOC and managed migration performed.
- \`R3_FULL_ARCHIVE_OFFLINE_REPLAY=NOT_RUN_FOR_CURRENT_SNAPSHOT\`: previous 230/230 evidence remains valid only for earlier snapshot.
- \`R4_MANAGED_SQL_RESTORE=NOT_STARTED\`: target has not received a real SQL import.
- \`STORAGE_R2_500MB_SAMPLE=NOT_DISPATCHED\` and \`STORAGE_TARGET_500MB_API_RESTORE=NOT_STARTED\`.
- \`FULL_INSUREIT_DR_CERTIFIED=NO\`: the intentional partial document scope does not close full Storage recovery requirements.

Never mutate production database \`ilzhsfqqjyppzzvfscmh\`, live Cloudflare app, R2 backups, or mobile application configuration as part of this rehearsal.
