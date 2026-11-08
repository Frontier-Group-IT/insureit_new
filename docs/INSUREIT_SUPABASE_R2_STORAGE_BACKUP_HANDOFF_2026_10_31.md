## 2026-11-08 — Backup frequency and recovery-readiness audit; PR safeguards only

- User requested (1) daily encrypted PostgreSQL archives after restore and coverage validation, (2) improved detection of delayed/missed GitHub backup schedules and (3) authentic recovery checks for roles, schema, records, auth data and Storage metadata. These goals are approved; production database write, R2 deletion, new paid Supabase resource and unverified recovery claims are not.
- **Verified Storage evidence:** scheduled R2 backups succeeded November 3–7 IST with 3,146 / 3,225 / 3,275 / 3,380 / 3,431 source objects, 9 buckets, each 15 sample decrypt/restore successes. GitHub schedule is consistently several hours late, not reliable for an exact 19:00 IST SLA. Latest November 7 storage run (scheduled November 7 evening) is run #42399691689; inspect its details separately.
- **Database R2:** the first manual archive run #41588451109 succeeded November 3, snapshot `20261103T061621Z`, 7,742,688 encrypted bytes. The PostgreSQL workflow remains `workflow_dispatch` only. Neither a nightly archive nor a fully proven standalone recovery exists. Existing Supabase Pro physical backups are an independent protection but their latest platform timestamps were not inspected through this GitHub audit.
- **Live read-only schema inventory on November 8:** `public` 181 BASE TABLEs, `auth` 27, `storage` 10, `realtime` 10, `supabase_migrations` 1, `vault` 1 and `insureit_recovery` 1. Inventory only; do not assume SQL archive captures or restores all tables.
- Adds a **separate PostgreSQL R2 freshness watchdog** (`monitor_postgres_backup.py`) within the existing GitHub backup monitor, using GitHub Actions metadata only. A deduplicated GitHub Issue is opened when the last successful encrypted PostgreSQL archive is older than 30 hours (or no success exists). It closes only when another successful backup is within that age. With PostgreSQL currently manual-only and last verified November 3, this alert is *expected to be active* after this monitoring change is merged, explicitly reporting the unprotected daily gap. The monitor does not trigger DB exports or require any Supabase/R2 keys.
- Proposed branch `feat/backup-freshness-coverage-gates-20261108`: storage watchdog on completion categorizes successful but >3-hour-late scheduled backups as **late**, and does not let manual success clear scheduled-freshness alerts. Adds 2-hour recurring watchdog checks alongside existing nominal check. Since GitHub cron itself may be delayed, **GitHub alone cannot guarantee exact backup time or rapid alert delivery**; an independent external scheduler/monitor is the future reliability requirement.
- Offline **data-only** replay now executes `SET session_replication_role = replica` within a single transaction in the network-disabled disposable PostgreSQL 17 container, following Supabase self-hosted restore guidance for circular foreign keys and potential double-encryption triggers. Never apply this trigger bypass in production. Roles/schema replay still fails on first SQL error; restored auth/storage counts are checked afterwards.
- Added `verify_postgres_offline_row_counts.py`: after a strict successful isolated SQL replay, compare archived COPY row counts against the restored `auth.users`, `storage.buckets` and `storage.objects` table counts. It never prints customer records, credentials or raw count values, and fails on any mismatch. A match is stronger than a marker, but still does not verify Supabase service configuration, permissions, JWT/OAuth settings or object binary restoration.
- Adds `audit_postgres_archive_coverage.py` with a fail-closed, offline SQL-marker audit for `auth.users`, `storage.buckets`, `storage.objects`, and at least one `public` table DDL marker, executed on the decrypted archive only in the isolated GitHub runner. A missing marker blocks the restore-rehearsal workflow; successful markers do **not** prove actual restored row counts, platform services, authentication or metadata completeness. No SQL contents or private rows are logged.
- The latest confirmed offline run before these changes reached schema extensions after role fixtures. A merged Supabase Postgres 17 image/extension preflight is available but no passing full replay has been verified in this audit. Next gates: run updated manual isolated restore, confirm per-component SQL successes and table/record counts with protected sample comparisons; verify auth and Storage metadata and complete service prerequisites, then enable the database nightly schedule with its own alerts after evidence/approval. Do not silently skip `roles.sql`, `schema.sql`, or `data.sql`.
- **Status:** this commit prepares monitoring and validation safeguards, **not** production database scheduling. No R2 data retention/pruning, prod restore, destructive SQL, mobile builds or deployment changes.

## 2026-11-03 — Offline restore roles passed; schema blocked by missing extension; Supabase Postgres image proposed

- Latest user-provided GitHub Actions output: encrypted archive integrity verification remained successful; offline PostgreSQL 17 container started; restricted role placeholders initialized; `roles.sql` restored successfully; `schema.sql` failed with sanitized `RESTORE DIAGNOSTIC: component=schema category=extension_missing`. `data.sql` was not attempted. Existing R2 archive and production DB are untouched.
- Read-only extension inventory on managed INSUREIT project `ilzhsfqqjyppzzvfscmh`: `hypopg` 1.4.1, `index_advisor` 0.2.0, `pg_stat_statements` 1.11, `pg_trgm` 1.6, `pgcrypto` 1.3, `plpgsql` 1.0, `supabase_vault` 0.3.1 and `uuid-ossp` 1.1. These values establish live extensions, but the sanitized output does not specify the *first* failing schema extension.
- Official Supabase self-hosted `docker/docker-compose.yml` at GitHub master referenced image `supabase/postgres:17.6.1.136` when reviewed. New PR branch `fix/postgres-restore-supabase-image-20261103` changes **only the offline Docker restore test** from `postgres:17` to pinned Supabase Postgres 17 image, preserving `--network none`, no exposed ports, ephemeral runner, no production credentials and fail-closed SQL errors. This image is NOT a full self-hosted Supabase stack, and suitability remains unproven until execution.
- Added a local-only `pg_available_extensions` count preflight for the seven non-`plpgsql` extension names enabled on INSUREIT. If fewer than 7 are available in the isolated image, the job stops with a sanitized count before attempting SQL replay; this does **not** install missing extensions or silently skip any database component.
- A successful extension availability count is not proof that extensions were created, that extension *versions* exactly match, or that role privilege and managed `auth`/`storage` schemas have been faithfully recovered. Schema/data restore and protected row-count comparisons remain mandatory.
- Pending: all CI checks, explicit merge, user-dispatched manual restore test and updated diagnostic. No scheduled DB backup, R2 deletions, prod restore, paid resource or app deployment authorized.

## 2026-11-03 — Isolated role prerequisite confirmed; test-only compatibility scaffold proposed

- Second isolated restore run (following PR #3942) successfully retrieved/decrypted the private R2 archive and started `postgres:17`, but stopped at `roles.sql` with sanitized `RESTORE DIAGNOSTIC: component=roles category=role_missing`. This is confirmed evidence of a missing role in the **offline target**, not evidence that encryption or R2 failed. Actual role name was intentionally suppressed.
- [Supabase's role documentation](https://supabase.com/docs/guides/database/postgres/roles) lists additional reserved PostgreSQL roles absent from vanilla Postgres; [official self-hosted restore guidance](https://supabase.com/docs/guides/self-hosting/restore-from-platform) requires a Supabase-compatible destination.
- Branch `fix/pg-restore-offline-supabase-roles-20261103` adds an explicit **test-only role-name fixture** (`scripts/backup/fixtures/isolated_supabase_roles.sql`). In the ephemeral `postgres:17 --network none` container *only*, missing recognized names are initialized with `NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`; no extra grants or password values. The workflow then continues strict `roles.sql` / `schema.sql` / `data.sql` checks and still fails on any unhandled SQL error with sanitized diagnostic labels.
- **Interpretation:** placeholder roles are an exploratory tool, NOT a replica of real Supabase permissions or platform-managed configuration. Even an all-green run would establish only a limited SQL replay test, NOT full Supabase disaster-recovery readiness, accurate RLS/role semantics, auth or Storage metadata coverage. A properly provisioned, isolated Supabase Postgres 17 target is required for stronger recovery validation.
- No SQL, R2 key or database secret is printed. Production PostgreSQL is not contacted by this restore workflow. R2 is read-only; no automatic database backup schedule or deletion/pruning enabled. Existing successfully committed encrypted archive and daily document backup remain intact.
- Next: ensure both CI checks pass, merge by user authorization, retry manual offline restore, capture next sanitized stage/category, then design authentic Supabase-compatible restore with schema and row-count comparisons.

## 2026-11-03 — Isolated PostgreSQL restoration failed at roles stage; diagnostic fix proposed

- Live manual isolated-restore run [#41590587004](https://github.com/Frontier-Group-IT/insureit_new/actions/runs/41590587004), job #125766159579: encrypted R2 retrieval/decryption/SQL extraction passed; `postgres:17` image pulled, detached offline container started; `roles.sql` failed with exit 1; `schema.sql` and `data.sql` were NOT attempted. R2 archive remains preserved. This is **NOT evidence of encrypted backup corruption**, nor proof of successful database recovery.
- Root SQL error **not yet known**: original workflow redirected `psql` stderr/stdout to temporary log and deliberately suppressed SQL text. A likely environmental hypothesis is that vanilla PostgreSQL does not provide Supabase-required roles/extensions. Do not claim a specific SQL error without new evidence.
- Branch `fix/postgres-isolated-restore-safe-diagnostics-20261103` adds a strictly allowlisted categorizer that reads local error logs but prints **only** stage and failure category (`role_missing`, `role_exists`, `extension_missing`, `permission_denied`, etc.). It does not print raw logs, role identifiers, SQL, table names or user data. Failures remain hard failures and temporary logs are deleted.
- No production Supabase reads/writes in restore workflow; R2 read-only; no R2 deletion, no daily DB schedule enabled. Next: CI -> PR merge approval -> manually retry offline rehearsal -> observe sanitized category -> create Supabase-compatible isolated target if needed and validate schema/data/auth coverage.
- Supabase official self-hosting guidance expects a **Supabase-compatible environment**, not plain `postgres:17`; roles, extensions, platform schemas and restore ordering matter. Keep reviewing the logical-dump scope before considering it a complete recovery strategy.

## 2026-11-03 — Phase 2 isolated PostgreSQL 17 restore rehearsal (PR-only; not yet run)

- Manual backup [run #41588451109](https://github.com/Frontier-Group-IT/insureit_new/actions/runs/41588451109) succeeded; `roles.sql`, `schema.sql`, `data.sql` generated, authenticated R2 archive committed under snapshot `20261103T061621Z` (7,742,688 encrypted bytes), with circular foreign-key warnings. This is not yet recovery certification.
- New branch `feat/postgres-r2-isolated-restore-20261103` adds `verify_postgres_r2_restore.py` and manual-only workflow `insureit-postgres-r2-restore-verify.yml`. **No automatic run or merge performed.**
- Workflow reads *only* R2 using existing GitHub environment secrets, validates project origin and timestamp in the encrypted manifest, downloads encrypted archive, authenticates AES-256-GCM and SHA-256, and safely extracts only the three expected SQL components on an ephemeral GitHub runner.
- Workflow then attempts `roles.sql`, `schema.sql`, `data.sql` in that order against an isolated **local PostgreSQL 17 Docker container launched with `--network none`**, without exposed ports or production database connection credentials. Runs `psql` with `ON_ERROR_STOP=1`. SQL output and errors are redirected to temporary runner files and deliberately not published as artifacts/logs; reports only successful stage or failed component. It checks nonzero public table count if all stages pass.
- **Expected limitation:** a stock PostgreSQL 17 image does not include Supabase-managed roles, schemas, extensions or app services. Consequently a failure in the rehearsal may indicate missing Supabase platform dependencies rather than a defective SQL archive; do not claim a full recovery failure or success without reviewing the stage and working toward a Supabase-compatible isolated target. A complete restored dataset including `auth.users` is **not proven** by these tests.
- Security: no Supabase production reads or writes in restore job, no R2 DELETE/PUT, no plaintext artifact uploads, no credentials printed, no scheduled restore, no mobile builds, no paid Supabase project.
- **Next gates:** pass PR backup-specific and web-portal CI, merge only with approval, manually run isolated restore job, review stage counts, resolve platform/schema coverage issues, then decide if daily database automation is safe. Continue retaining all R2 snapshots without automatic deletion.

## 2026-11-03 — Credentials supplied; manual archive readiness

- User reports `DATABASE_URL` and separate `DB_BACKUP_ENCRYPTION_KEY` GitHub environment secrets are now set; values cannot be inspected via GitHub and connection permissions are **not yet verified**.
- Revalidated code tests; reviewed Supabase CLI reference, removed unsupported/unverified extra `-x` exclusions from `--data-only` command. Scope limitation: Supabase CLI defaults exclude platform-managed `auth` and `storage` schemas, so first archive must NOT be called a complete database disaster-recovery copy until coverage and separate data-recovery procedure are independently verified.
- Manual-only archive remains gated behind PR checks and merge; a successful archive encryption/readback is not proof of restore completeness. Never copy DB credentials or decrypted customer data into chat, logs or PRs.
- No scheduled database backups, no PITR add-on, no R2 retention deletes, no DB writes.

## 2026-11-03 — Phase 2 approved: manual PostgreSQL archive implementation

- User approved the **design and work in a separate PR**, not a production dump execution, credential changes, database restoration, PITR billing or automatic schedule activation.
- New branch `feat/r2-postgres-manual-backup-20261103`, workflow `.github/workflows/insureit-postgres-r2-manual.yml`, script `scripts/backup/postgres_to_r2.py`, and secret-free unit tests. GitHub Actions workflow is **manual dispatch only on `main`**, uses existing `insureit-production-backup` environment branch restricted to `main`, and leaves daily document backups untouched.
- Pinned Supabase CLI **2.122.1** through `supabase/setup-cli@v3` and Python `boto3==1.35.99`, `cryptography==44.0.2`. CLI uses Docker on Ubuntu runner. Follow Supabase documented three-part logical dump (`roles.sql`, `schema.sql`, `data.sql`), using the documented CLI commands with no extra table exclusion flags. Supabase CLI defaults exclude some platform-managed schemas such as `auth` and `storage`; separate audit/export strategy is required to prove coverage of `auth.users` and Storage metadata. This is a **logical recovery archive**, not an image of every Supabase managed service.
- The three SQL components are assembled into a temporary gzip tarball and **AES-256-GCM encrypted locally**, uploaded under independent `postgresql/v1/` prefix in existing private `insureit-production-backups` R2 bucket, then downloaded and authenticated with SHA-256. Only after readback verification does it publish encrypted manifest and `latest.json`. No R2 DELETE or source DB writes. Plaintext SQL files exist only on an ephemeral GitHub runner while export and encryption are running; no artifact upload.
- **Two new GitHub environment secrets are still required**: `DATABASE_URL` — a properly authorized **read-only/full-recovery-compatible** PostgreSQL session-pooler URL, not the Supabase service-role API key — and `DB_BACKUP_ENCRYPTION_KEY` — base64-encoded 32 random bytes, generated separately from the Storage backup encryption key and escrowed outside GitHub. Never paste into chat or PR. Verify password/URL encoding and that the credential covers necessary `auth`, `storage`, `public`, migration and custom schemas; expect a read-only role to fail for privileged role metadata if permissions are insufficient. **Do not reset the live database password** merely to obtain access without separate review.
- SQL export is read-only in intent; however, it places temporary query load on the production PostgreSQL server, may generate egress, and can fail due to privilege/extension compatibility. The job has a 90-minute timeout. First execution requires approval after reviewing the exact credential and comparing expected schemas/rows.
- A successful upload/readback is **not a completed recovery drill**. Next gates: independent restore into an isolated disposable Postgres 17/Supabase-compatible environment, compare roles/schema row counts, verify auth users and migration history where applicable, and document any unsupported Supabase-managed config/extension. Do not automatically restore into production.
- **Daily database schedule, database failure alert, R2 deletion/pruning and retention are NOT enabled**. Those require separate successful restore evidence and approval; temporary loss of backup encryption key prevents restoring archives.
- The existing Pro daily physical backups (7-day retention) and R2 Storage daily encrypted backups continue unchanged. No additional Supabase project, paid PITR add-on, database role/secret, migration or app deployment was created by this PR.
- Existing documentation PR #3924 proposed the high-level design. This implementation adds the operational steps to the **same handoff document**; do not lose earlier incident history. Future agents should inspect current status from latest sections, not outdated original draft wording.

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
