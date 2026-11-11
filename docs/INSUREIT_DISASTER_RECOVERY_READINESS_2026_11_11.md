> **Historical assessment notice (updated 11 November 2026):** This report was drafted *before* the actual 3,534-file R2 complete verification succeeded and before daily PostgreSQL scheduling was merged. Do not treat its “not yet merged/executed” or “PostgreSQL schedule not yet enabled” instructions as current. The live status and all run evidence are in [the consolidated original handoff](./INSUREIT_SUPABASE_R2_STORAGE_BACKUP_HANDOFF_2026_10_31.md); the actionable certification gates are in [the full DR plan](./INSUREIT_FULL_DISASTER_RECOVERY_CERTIFICATION_PLAN_2026_11_11.md). The new Storage source-to-manifest audit is separate and not yet executed.

# INSUREIT disaster recovery readiness — 11 November 2026

This is a **recovery assessment**, not authorization to restore production,
change credentials, enable automatic PostgreSQL backups, delete R2 backups,
or deploy Cloudflare/Vercel or any mobile app.

## Verified evidence

- [R2 v2 encrypted PostgreSQL backup run #2](https://github.com/Frontier-Group-IT/insureit_new/actions/runs/42965931610): consistent snapshot saved with **231 table definitions**, **230 COPY data targets**, **287 RLS policies**, **20 sequence records**, and **zero missing required data targets**. Encrypted upload/readback passed.
- [Protected isolated PostgreSQL restore run #4](https://github.com/Frontier-Group-IT/insureit_new/actions/runs/42978088652) succeeded: authenticated R2 archive, strict PostgreSQL transactional restore including archive grants, **230/230 COPY table-data targets and 0 row-count mismatches**. Offline temporary target used **two placeholder role names**; source role semantics and original object ownership were **not restored** because the workflow imports with `--no-owner`.
- The successful offline run destroyed the decrypted dump and disposable container afterward. It is **not** an operating self-hosted Supabase instance.

## Read-only source inventory (2026-11-11; counts change with live traffic)

Production project: `ilzhsfqqjyppzzvfscmh`, PostgreSQL 17.6.

| Domain | Read-only observation | Verification still needed |
| --- | --- | --- |
| Role catalog | 15 non-`pg_*` role names | Exact login/replication/BYPASSRLS/inherit/CREATEROLE flags, memberships and `SET`/inherit/admin grant options on a **real recovery target** |
| Role memberships | 19 membership edges in the read-only source query | Compare each edge and options; no privilege escalation shortcuts |
| Auth | 86 `auth.users`, 90 `auth.identities` | Identity provider configuration, JWT secrets / signing keys, SMTP, redirects, authentication smoke test and token lifecycle on a **separate** target |
| Storage metadata | 9 `storage.buckets`, 3,603 `storage.objects` | Independently verify all corresponding actual R2 file bytes and then reproduce object download/auth behavior |
| Owner distributions | `public` tables are principally `postgres`-owned; `auth` tables are `supabase_auth_admin`-owned; `storage` tables are `supabase_storage_admin`-owned; Realtime and Vault also have managed owners | Actual `OWNER`/function `SECURITY DEFINER` semantics must match source; `--no-owner` restore alone cannot establish them |
| Database integrity | Strict PostgreSQL restore and all archived COPY row counts passed | Full application requests, Auth login, Storage downloads, scheduled functions and integrations remain untested |

These are **aggregate metadata only** from read-only database queries; no user emails, documents, raw SQL, passwords, JWTs, object paths or customer identifiers are stored in this report.

### Why PostgreSQL-only success is not full disaster recovery

The v2 backup includes managed `auth` and `storage` **database tables**, but it does not restore Storage **file bytes**, Auth provider settings, JWT signing keys, managed production role memberships, source object ownership, Supabase service configuration, SMTP, external integrations or deployed Edge Functions. The successful isolated run used two NOLOGIN placeholders and `--no-owner`, so it cannot establish safe production-grade privilege equivalence.

Supabase documents these cross-service gaps in its [platform-to-self-hosted restore guidance](https://supabase.com/docs/guides/self-hosting/restore-from-platform).

## Storage binaries: current implementation and new audit

- Existing `insureit-supabase-storage-r2-backup.yml` **already schedules daily 19:00 IST** incremental encrypted Storage-file backups using the protected `insureit-production-backup` environment; it uploads encrypted objects to the private `insureit-production-backups` bucket under `supabase-storage/v1/`.
- The daily workflow calls `verify_r2_restore.py` with its existing `sample` default: only deterministic samples per nonempty Storage bucket are downloaded, decrypted, SHA-256 checked, and byte-length verified. A successful daily sample test does **not** prove every file is recoverable.
- New `insureit-r2-storage-complete-verify.yml` is **manual-only on main** and uses `VERIFY_STORAGE_SCOPE=all`. It authenticates the latest encrypted manifest, enumerates **every** manifest entry, verifies **every referenced encrypted R2 blob**, decrypts only in memory, compares SHA-256 and exact byte length, rejects any missing/corrupt blob, and confirms verified file count equals manifest entry count.
- This full verifier uses **R2 GET only**, needs no production Supabase credentials and writes no plaintext to disk or artifacts. Nothing is uploaded, deleted, modified, published or re-encrypted. The existing daily Storage backup behavior is unchanged. Results contain aggregate object counts and bytes only.
- **New all-file workflow is not yet merged or executed against R2.** Its sample/scope code is tested using synthetic encrypted bytes. A real run must be manually approved after PR checks and merge.
- Even after a full R2 file verification passes, independently compare the manifest's point-in-time file inventory to a same-period Supabase source inventory, including bucket coverage, and perform a separate authenticated download from a disposable recovery Storage service. The live `3,603` metadata-row count is an observation at a different point in time, **not an assumed manifest count**.

## Controlled recovery sequence

1. Preserve the successful v2 ciphertext, encrypted manifests, storage archives, R2 access controls, key escrow and v1 objects. Do not enable retention pruning.
2. With explicit approval, merge and manually run the separate **all-file Storage readback** workflow from `main`, subject to protected environment approval. Record run link, manifest snapshot, file count, byte total, verification outcome and any failures. Do **not** report sample-only success as full recovery.
3. Reconstruct PostgreSQL role **attributes, memberships and original ownership** in an isolated, compatible target using a reviewed role-migration plan, not the present NOLOGIN placeholders. Verify grants, role `SET` options, `SECURITY DEFINER` functions, Auth, Realtime and Storage roles without giving ordinary roles superuser powers.
4. Restore Supabase Auth application configuration **through an approved secure secrets path**, not this repository. Independently validate login/logout, protected API access, customer identity scope, external provider redirects and recovery of existing accounts. No real customer login or email should be attempted without approval.
5. Validate actual Storage bytes, content type and authorization against a temporary recovery Storage endpoint (production untouched); then verify the app's document flows with synthetic test accounts.
6. Document RPO/RTO targets, owner, access grants, encryption-key escrow rotation, restoration steps, monitoring, and a no-delete/retention policy for both independent PostgreSQL and Storage backups.
7. Only after all the above pass, separately review and approve any **new automatic PostgreSQL-to-R2 schedule**. Do not enable cron in this PR.

## Safety

Production SQL operations in this investigation were **SELECT-only**, run through the connected Supabase project. No production migrations, roles/permissions changes, R2 write/delete, managed credential dumps, live customer impersonation, deployment, merge or PostgreSQL automation are authorized by this report.

The repository's `docs/INSUREIT_SUPABASE_R2_STORAGE_BACKUP_HANDOFF_2026_10_31.md` records the previous failed and successful restore phases. Historical notes marked "PR pending" describe their contemporaneous state and are not an instruction to rerun or merge previously closed work.
