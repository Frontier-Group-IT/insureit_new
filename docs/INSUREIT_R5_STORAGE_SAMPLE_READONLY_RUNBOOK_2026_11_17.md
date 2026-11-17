# INSUREIT — R5 read-only, bounded Storage recovery-sample preflight

**Date:** 17 November 2026. **Status:** review-only; no sample Storage files have been uploaded.

## Verified recovery starting point

- Isolated managed Supabase recovery project: **`INSUREIT_VAPT_ISOLATED`**, project reference **`klnodxnmlqbofolxxrsr`**, in independent account/organization. It must NOT be connected to any live application, email/SMS, webhooks or notification dispatch.
- Real target SQL import [R4 run #44044851869](https://github.com/Frontier-Group-IT/insureit_new/actions/runs/44044851869) **SUCCESS**, archived PostgreSQL v2 snapshot `20261117T041507Z`: 183 application tables, 183 RLS-enabled application tables, 252 source public policies, 446 public functions, 87 Auth users, 91 Auth identities, 75,733 rows reconciled across 211 selected COPY targets with 0 row-count mismatches. API table grants intentionally revoked; no production connection/write.
- At R5 preparation: isolated Storage buckets 0, Storage objects 0, Auth users 87, identities 91, public app tables 183. Target DB is already populated with SQL; **the old R0/R1 preflight rejects nonempty targets and cannot be reused for R5**.
- Source Storage **live read-only** inventory at planning time: 9 buckets, 3,925 object metadata rows in 8 populated buckets, approximately 1,872,423,668 bytes across object metadata (time-variable). **Live inventory is not the authenticated R2 manifest**. The encrypted R2 Storage manifest is version **v1** and has its **own independent `created_at` snapshot**, not the SQL archive snapshot.

## R5 scope and safeguards

The distinct manual [R5 GitHub Actions workflow](../.github/workflows/insureit-isolated-storage-r5-preflight.yml) MUST run only on `main` through protected `insureit-recovery-isolated` environment, after separate PR review and merge. This job:

1. Parses `INSUREIT_RECOVERY_DATABASE_URL` against the strict isolated destination allowlist before any R2 access. Connects with the target-specific CA in `RECOVERY_DB_SSL_ROOT_CERT_PEM` and **`sslmode=verify-full`** in a **READ ONLY transaction**. Fails unless SQL-recovered project still has exactly 183 application tables, 87 Auth users, 91 identities, zero Storage buckets/objects, zero exposed security-definer functions, and still-deferred Auth/Storage security metadata. This job NEVER reuses the old empty-target-only check.
2. Uses dedicated GET-only R2 identity, Storage backup decryption key and encrypted authenticated latest Storage v1 manifest. **Never uses the live Supabase production API/key** or writable R2 credentials.
3. Plans a deterministic cross-bucket/class/size sample with **`MAX_TOTAL_BYTES=500000000`** (decimal 500 MB, not 500 MiB), **`MAX_FILE_BYTES=50000000`**; large objects are excluded and counted.
4. Optional second operator-controlled job execution fetches/decrypts/verifies SHA256 and byte count for every selected ciphertext object, with total plaintext bounded. Both modes print only aggregate object/bucket/class/bytes and Storage snapshot timestamp; **no customer filenames, policy content, SQL, keys or R2 object paths**.
5. Has **NO** Storage API upload, bucket creation, SQL DML, database privilege change, R2 PUT/DELETE, app deployment, object-metadata insertion, application cutover, or artifact upload.

The Storage manifest's authenticated timestamp is printed as `storage_snapshot=YYYYMMDDTHHMMSSZ`, independent of the SQL backup's `20261117T041507Z` timestamp. For the **first PLAN run**, the `expected_storage_snapshot` field may be blank; the second `--verify` run should pin the timestamp from the first run exactly, and refuse manifest pointer drift. Never copy the SQL snapshot into the Storage-snapshot field without independent verification.

## Secrets prerequisite (GitHub protected environment only)

The protected GitHub environment `insureit-recovery-isolated` needs the pre-existing isolated SQL secrets, plus **one Storage-specific secret**:

- `RECOVERY_STORAGE_BACKUP_ENCRYPTION_KEY` — exact original **base64 32-byte Storage backup AES-256 key** used by the scheduled `supabase-storage/v1` backup. It is DISTINCT from `RECOVERY_DB_BACKUP_ENCRYPTION_KEY`. Set it privately in the GitHub **environment secrets** from an approved escrow; NEVER post its value in chat, source code, a PR, GitHub issue, Actions logs or an artifact. This R5 workflow does not accept the source Supabase service-role key.

The R2 identity uses existing `RECOVERY_R2_ACCOUNT_ID`, `RECOVERY_R2_READONLY_ACCESS_KEY_ID`, and `RECOVERY_R2_READONLY_SECRET_ACCESS_KEY` scoped GET-only to the encrypted backup bucket.

### Operator instructions after PR approval / merge

Open `https://github.com/Frontier-Group-IT/insureit_new/actions/workflows/insureit-isolated-storage-r5-preflight.yml`, choose `main`.

**First PLAN-only run:**

| Input | Value |
| --- | --- |
| `expected_storage_snapshot` | Empty (discover signed/authenticated Storage latest pointer) |
| `verify_storage_sample_bytes` | **false** (unchecked) |
| `confirm_isolated_target` | **true** only when app isolation, notification suppression and access restrictions were independently confirmed |

Review `RECOVERY STORAGE SAMPLE PLAN ONLY:` with the sample's byte count, bucket coverage, oversize exclusions, content classes, and `storage_snapshot` timestamp.

**Second R2 readback-only run:** enter the **exact Storage snapshot** printed by the plan, set `verify_storage_sample_bytes=true` and retain `confirm_isolated_target=true` after confirming isolation. Expect `RECOVERY STORAGE SAMPLE R2 VERIFIED` with the same counts and `storage_pointer_locked=1`. It can take longer because selected ciphertext is decrypted and hashed in memory. Stop on changed latest pointer or any SHA mismatch. No files are uploaded to target.

## Remaining R6 / service parity — NOT covered here

After R5 passes and separate explicit **Storage API upload** approval:

- Prepare target-only recovery Storage API authorization, *never* production service-role credentials; check published/account-specific quota and 50 MB per-file limit, plus sample's plaintext bytes and target's existing usage.
- Review original bucket classifications, visibility, allowed MIME types, per-file limits, allowed paths, metadata and tenant visibility **privately**. Use native target Storage API to create only needed buckets and upload selected verified R2 bytes; never write `storage.objects` directly. No public bucket or source policy automatically recreated without review.
- Re-GET selected target files through authorized target Storage API, compare byte size and SHA256 with the authenticated R2 manifest, verify intended access denial/allowance with controlled test identities; avoid exposing personal insurance documents to user-facing logs.
- Run separate managed role/RLS/ACL, custom Auth trigger, Realtime/Vault, database API grant, backup freshness and end-to-end app smoke tests before full DR certification. The bounded 500 MB test cannot prove full Storage object parity for the source's larger inventory.

**Not certified:** `FULL_INSUREIT_DISASTER_RECOVERY`, `COMPLETE_STORAGE_RESTORE`, role-owner semantics, source SQL API parity or application cutover.
