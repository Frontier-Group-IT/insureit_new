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
