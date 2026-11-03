## 2026-11-03 — First scheduled backup verified; late watchdog bug diagnosed and fix prepared

- Scheduled backup run [#41536860319](https://github.com/Frontier-Group-IT/insureit_new/actions/runs/41536860319) was **successful** (event `schedule`, branch `main`). Scheduled for **2026-11-02 19:00 IST**, but actually started **2026-11-03 03:53 IST** (GitHub schedule delay approximately 8h53m) and finished near 04:16 IST. No evidence this delay was caused by Supabase or R2.
- Backup run log: **3,146 source objects, nine buckets, 3,103 reused, 43 newly uploaded, zero transfer errors**; encrypted manifest committed. In-job restore verified **15 sample files across eight populated buckets**, one bucket empty. Samples are not exhaustive verification of all files.
- Completion-triggered backup alert monitor run [#41539952426](https://github.com/Frontier-Group-IT/insureit_new/actions/runs/41539952426) succeeded.
- Scheduled watchdog run [#41548956773](https://github.com/Frontier-Group-IT/insureit_new/actions/runs/41548956773) failed with `Staleness monitor unexpectedly ran too early`: its delayed execution crossed IST midnight and incorrectly targeted the **upcoming** 19:00 rather than the most recent 19:00.
- Branch `fix/r2-watchdog-midnight-delay-20261103` corrects the target to the **most recent 19:00 IST** and removes the UTC-day restriction on run lookup, retaining a 10-minute early tolerance and three-hour grace period. Manual checks inside grace return cleanly without opening alerts. Tests cover the exact incident (late GitHub cron, after-midnight watchdog), the next day's rollover and genuinely missing runs.
- **Status until merged/tested:** existing backup and R2 contents remain safe; alert timing correction is PR-only. No production database, auth, R2 secret, backup scheduler, encryption, or deletion rules are modified.
- Preserve the existing append-only backups. **No automatic R2 retention deletion or 30-day pruning is enabled.** Verify first post-fix watchdog and GitHub Issue notification delivery. The GitHub-based watchdog cannot guarantee detection if GitHub scheduling is down; independent external heartbeat monitoring remains an optional later safeguard.
- Next: CI checks -> explicit PR merge approval -> verify a scheduled/dispatch watchdog run with **no false alert**, then evaluate scheduling reliability and alert notification delivery. The observed 7 PM schedule delay does not imply a guaranteed start time.

## 2026-11-02 — Failure and missed-backup alerts (GitHub Issues)

- New `insureit-r2-backup-monitor.yml` observes each completed backup run via `workflow_run` and independently checks for missing/failed 19:00 IST scheduled runs at **22:47 IST** daily (17:17 UTC). A manual monitor trigger is available.
- The monitor has **no Supabase/R2 service credentials**. Only `GITHUB_TOKEN` with scoped `actions: read`, `issues: write`, and `contents: read` permissions.
- Failed, cancelled or otherwise non-successful backup runs open/update a single deduplicated GitHub Issue. A missed daily scheduled run also opens the same issue; a later successful run closes it.
- Watch or subscribe to repository Issues and enable GitHub email/mobile notifications. GitHub issue creation by an automation **does not guarantee direct email** for every repository participant. Verify organization Actions settings allow issues write permissions. Test by manually dispatching the monitor only *after a scheduled backup has already succeeded* to avoid a deliberate missing-backup alert.
- Independent watchdog is itself GitHub scheduled automation, so a GitHub-wide scheduling disruption could also skip the watchdog. External uptime monitoring can be added as a future defense.
- No bucket lifecycle rules, R2 deletion or 30-day pruning has been configured. Existing encrypted blobs/checkpoints and snapshots remain untouched.
- Cloudflare R2 Standard free monthly allowances: 10 GB-month storage, 1M Class A operations, 10M Class B operations. Changes are incremental; unchanged documents normally do not require downloads from Supabase, but each backup still enumerates source and performs checkpoint / R2 lookups. Supabase egress, GitHub Actions compute and usage overages should be monitored.

## 2026-11-02 — Daily schedule at 19:00 Asia/Kolkata

- Requested schedule: **7:00 PM IST daily**, equivalent to `30 13 * * *` UTC in GitHub Actions.
- GitHub scheduled jobs are best-effort and can start late or occasionally be dropped; monitor failures, stale latest-manifest age and completed scheduled runs.
- The backup workflow retains a `workflow_dispatch` manual trigger and uses environment `insureit-production-backup` on `main` only. The existing encrypted incremental process remains append-only; no R2 deletions or 30-day retention pruning is enabled.
- A successful scheduled job must run isolated sample restoration after the manifest is committed. Any verification failure marks the run failed.
- **GitHub environment required-reviewer protection can block unattended scheduled runs** until a reviewer approves. Verify environment settings before relying on automation: permit trusted `main` only, avoid human approval gates for this unattended environment while retaining strict branch restrictions, and safeguard secrets.
- Failure reporting: GitHub Actions failed-run status and GitHub notification settings are available; no independent email/alert integration has been configured. Add stale-backup monitoring and notification after a separate review.
- Once merged, verify the first scheduled run executes and its resulting R2 manifest/restore report; previous snapshot 3,107 entries is not itself proof of daily scheduling.
- No API key changes, no database migrations, no application redeploy and no APK/AAB.

## 2026-11-02 — Complete encrypted snapshot and restore rehearsal

- Manual backup run #41406855021 succeeded: 3,107 verified source-object entries, nine buckets, 3,098 reused and nine new uploads; encrypted manifest was committed.
- Isolated restore verification proposed in branch `ops/r2-backup-isolated-restore-test-20261102`. **Not yet run against R2**.
- A new manual-only GitHub workflow `.github/workflows/insureit-r2-restore-verify.yml` runs on trusted `main` with existing `insureit-production-backup` environment secrets. No Supabase API or service-role credential is needed in the restore job.
- Checks R2 latest pointer and encrypted manifest, validates project reference, verifies two in-memory samples per nonempty bucket (one if bucket contains only one), validates exact decrypted byte count and SHA-256. No plaintext artifacts or object paths logged.
- **Limit:** samples confirm recoverability only for sampled objects, not exhaustive byte-for-byte verification of all 3,107 source objects. A manifest containing only corrupted unselected objects would still pass. Supabase document content is not fetched by restore verification.
- No schedule/retention modifications. Do not claim recovered samples until workflow run reports success. Future schedule and retention need explicit approval and protection against referenced-blob deletion.

## 2026-11-02 — Interrupted first backup and proposed recovery (NOT DEPLOYED)

- First manual workflow run 41201242212 timed out after 120 minutes; setup, secrets check and dependency install passed; backup step emitted no progress; no completed manifest verified.
- Cloudflare screenshot shows 862.31 MB encrypted blobs in a 20261031 snapshot prefix. **Do not delete these files.** Supabase Storage metadata indicated about 3,092 objects / 1.33 GB at inspection.
- Branch fix/r2-backup-resume-progress-20261102 adds 8 concurrent workers, bounded HTTP/R2 timeouts/retries, and progress counters every 25 source objects.
- Each verified object now writes an encrypted, authenticated checkpoint. A subsequent run validates metadata and R2 blob existence before reuse. If source changes, its checkpoint key changes.
- Recovery of original uncheckpointed ciphertext matches SHA256 of the source object to decrypted candidate content under its exact identity; never assumes a matching filename alone means valid backup.
- No source write/delete and no R2 delete. A new manifest and latest pointer are written **only after every object succeeds**.
- **No automatic schedule or 30-day pruning.** Tests and recovery verification must pass before claiming protection.
- First manual retry after merge requires explicit user authorization. CI checks require zero production secrets.
- Outstanding: independent sample restoration and documented secret escrow, coverage audit, billing check, and schedule/retention approval.

# INSUREIT — Supabase Storage → Cloudflare R2 (draft; disabled)

## Status (2026-10-31)
- **PR ONLY / NOT MERGED / NOT RUN / NO SCHEDULE**. Never assume any backup exists until R2 objects and a restoration are verified.
- Production Supabase allowlist: `ilzhsfqqjyppzzvfscmh`.
- Source is Supabase Storage, **not PostgreSQL**. PostgreSQL is already covered by Supabase Pro scheduled backups.
- Target R2 bucket: `insureit-production-backups`. Private access, Standard storage.
- Manual dispatch only; job runs only on `main` using GitHub environment `insureit-production-backup`. No pull_request trigger, no push trigger, **no automatic schedule**.
- No destructive API calls: never deletes source objects or R2 versions. There is **no 30-day lifecycle cleanup yet**. Add only after tested restoration and manifest reference-aware garbage collection design.

## Before first run
1. GitHub environment should allow **main only** and use required reviewers when supported. Never permit untrusted PR code to consume service-role secrets.
2. Existing environment secrets: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. Values must not be printed or committed.
3. **One more secret required:** `BACKUP_ENCRYPTION_KEY` — base64 of 32 random bytes. Generate locally, for example: `python -c "import base64,secrets;print(base64.b64encode(secrets.token_bytes(32)).decode())"`. Save it securely offline in a password manager / recovery vault before adding as an environment secret. Do not share it in chat.
4. Confirm the R2 token is **bucket-scoped Object Read & Write** and that the database service-role key is restricted to this trusted workflow only. A Supabase service-role key remains highly privileged despite intent to read Storage.
5. Review expected source object count and size, GitHub runner capacity, Cloudflare R2 usage allowances, and Supabase egress pricing.
6. Only after PR CI checks and explicit approval, merge; then manually dispatch workflow from `main`.

## How it works
- Lists Supabase Storage buckets and recursively lists each folder using the Storage REST API.
- Previous encrypted snapshot is loaded from R2; object `updated_at` is used to avoid redownloading unchanged objects.
- Changed objects are downloaded over HTTPS and individually encrypted with AES-256-GCM using a random nonce and the object identity as authenticated associated data.
- Uploads immutable ciphertext blobs, retrieves them again, decrypts, and compares SHA-256.
- Writes a new encrypted manifest referencing every current object, and finally updates `latest.json` as the commit pointer.
- Prior snapshots and removed-source object versions remain in R2; **retention pruning is intentionally deferred**.
- Source files are never modified.

## Important operational risks
- An expired or lost `BACKUP_ENCRYPTION_KEY` makes backups unrecoverable. Keep a separately escrowed recovery copy.
- The active R2 credential is allowed to overwrite and delete objects; protect the credential and consider a separate read-only restore identity. The backup runner never issues delete calls.
- A daily `latest.json` pointer and encrypted manifests enable recovery only if all referenced immutable blobs still exist. Do not enable broad bucket lifecycle expiration.
- The first run may upload all files and incur Supabase download egress and R2 storage/operations charges. Objects larger than 250 MiB abort as a protective runner memory limit.
- A partially failed run might leave unreferenced ciphertext in R2, but does not change the last successful manifest pointer.
- Metadata-based skip is conservative only when `updated_at` is available and accurately reflects source changes. A dedicated restore utility and recovery drills are required before declaring backup protection operational.
- Source files deleted after a run remain present in prior encrypted manifests. The newest manifest reflects only currently listed source files.
- The initial design requires real test evidence before any scheduling, retention pruning, or production recovery guarantee.

## Acceptance gates
1. Static check and PR CI pass.
2. Verify GitHub environment branch restriction and approval requirements.
3. Backup run from default branch succeeds after explicit approval.
4. Independently restore sample PDFs/images from several buckets; confirm SHA-256 and correct customer-file isolation.
5. Confirm every expected bucket/object was included, including empty buckets (recorded in manifest).
6. Confirm alerting and costs; then propose a daily 20:30 UTC schedule (02:00 IST) and deletion-safe 30-day retention for separate approval.
7. Run periodic restoration drills, not just successful upload checks.
