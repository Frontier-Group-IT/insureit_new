# INSUREIT Firebase — Protected Auth Backup Operator Handoff
**Date:** 2026-10-17
**Project:** `ilzhsfqqjyppzzvfscmh` (PostgreSQL 17)
**State:** source and synthetic testing only; **no production backup created**

## Scope and strict boundary

The repository's `scripts/customer-firebase-auth-encrypted-backup.sh` streams the complete Postgres `auth` schema to an age-encrypted `pg_dump` custom archive, writes only encrypted bytes and a portable SHA256 checksum, and refuses a connection URL missing the expected project reference. The companion `scripts/customer-firebase-auth-restore-rehearsal.sh` verifies the checksum, requires explicit isolated-database acknowledgement and a loopback TCP target, rejects existing `auth.users` or `auth.identities`, and streams decrypted archive bytes into `pg_restore` without placing plaintext dump files on disk. During the data-only restore, it temporarily disables foreign-key triggers within the single disposable transaction to accommodate tables whose archive order does not follow references, then re-enables them; it rejects orphaned `auth.identities` rows. Its restore occurs in one database transaction. The operator must independently review all other Auth referential integrity and GoTrue authentication tests. **No part of this toolkit fetches production credentials, keys or data through GitHub Actions or ChatGPT.**

This is **not** an automated production backup and does not assert a full Supabase project recovery. Supabase Storage object bytes, other application schemas, signing/encryption infrastructure and external secrets are outside this Auth-only export. Credential recovery may depend on additional protected platform configuration. A restore into a matching GoTrue schema and original account-login proof are mandatory before approving Auth identity changes.

## Operator-only steps (run locally; DO NOT send values into this chat or CI)

1. On a trusted machine or isolated administrator workstation, install PostgreSQL **17+** command-line clients (`pg_dump`, `pg_restore`, `psql`), `age`, `sha256sum`, and `python3` in Bash/WSL2. Ensure exact tool versions match the live PostgreSQL major as needed. Confirm the computer has full disk encryption and an access-controlled output folder outside the Git checkout.
2. Create an X25519 age recipient key pair. Store the **private** identity key exclusively in a separate secured credential vault/offline store. Extract only the `age1...` **public** recipient string for backup encryption. Never paste the private key or production DB URL into chat, GitHub, a PR, Actions logs or a ticket.
3. In the Supabase Dashboard for `ilzhsfqqjyppzzvfscmh`, obtain an authorized direct/pooler Postgres connection URL with protected `auth` schema read permissions. Enter it only into the local secure shell. The URL must identify the exact INSUREIT project reference. Check existing managed Backup status in **Database > Backups** if available; it is supplemental evidence, not a replacement for an independently tested Auth identity restore.
4. Set the environment variables locally, without shell history or echoing secrets:
   - `INSUREIT_BACKUP_DB_URL` = owner-authorized project PostgreSQL connection.
   - `INSUREIT_BACKUP_AGE_RECIPIENT` = public `age1...` recipient.
   - `INSUREIT_BACKUP_DIR` = access-controlled external directory.
   Execute `bash scripts/customer-firebase-auth-encrypted-backup.sh`.
5. Verify that the output contains exactly one new `insureit-auth-*.dump.age` and its `.sha256` file; validate file permissions and checksum. Place an independent access-restricted encrypted copy plus its manifest offsite. Verify that the separate private key is accessible to an authorized recovery reviewer. Neither the file nor the private key belongs in GitHub or customer messaging.
6. Prepare a **disposable** Supabase-compatible local database with the **same GoTrue/Auth schema and migrations** as production and an empty Auth user/identity population. Never target production, even temporarily. Supply the owner-held encrypted archive, private key path, and loopback target to the restore script using:
   - `INSUREIT_BACKUP_FILE`
   - `INSUREIT_BACKUP_AGE_IDENTITY`
   - `INSUREIT_RESTORE_TEST_DB_URL` using `127.0.0.1` or `localhost`
   - `INSUREIT_RESTORE_ISOLATED_ACK=I_CONFIRM_DISPOSABLE_AUTH_DB`
   Execute `bash scripts/customer-firebase-auth-restore-rehearsal.sh`.
7. The restore script establishes **only** decryption/parse/import and existence of restored Auth users. Independently verify **GoTrue startup**, an approved account's **original sign-in**, the **same pre-backup Auth UUID**, identity rows, refresh session, and full rollback for the planned alias/credential change. Confirm schema compatibility and downstream profile/Customer references under a privacy-safe local fixture. If any check fails, backup remains **unverified**.
8. Record in the private release register **only** encrypted archive digest, backup timestamp, offsite-retention attestation, matching schema/GoTrue version, restoration verdict, and owner/security reviewer signatures. Do not record password hashes, decrypted rows, actual Customer phone numbers, OTPs, Firebase UIDs, signing keys, or JWTs in public documents.

## Synthetic verification in GitHub

The source branch includes a **disposable-only** GitHub Action at `.github/workflows/verify-customer-firebase-auth-backup-pipeline.yml`. It uses synthetic Postgres 17 `auth.users` and `auth.identities` fixture, a temporary age key, encryption/decryption, same synthetic UUID/hash/identity assertions, and negative tests for incorrect key, archive corruption, a nonempty destination, and remote restore attempts. **No real Auth dump/keys are sent to GitHub**, and no artifact is uploaded.

Passing this workflow demonstrates script mechanics and basic safety guards, **not** restoration of production data or original GoTrue login.

## Absolute no-go conditions

No verified recipient-held key, no encrypted archive and checksum, no independently retained offsite copy, no matching GoTrue restore acceptance, no independently approved and consenting Customer identities, or any data/session mismatch. Do **not** run live Auth password/email mutations, activate Customer rollout, deploy a migration, merge the Firebase PRs, push an OTA, build APK/AAB, or retire 2Factor while any gate is open.

## Implementation and audit provenance

- **Stack:** new source-only branch based on draft PR #3216 `feat/customer-firebase-rls-session-isolation-20261017`; do not merge/deploy.
- **Prior proof:** GitHub Actions #39009766593 restored the original encrypted password hash in disposable synthetic GoTrue after simulated credential change, but was not an encrypted production backup.
- **Other gates:** `docs/CUSTOMER_FIREBASE_PRODUCTION_SECURITY_GATES_2026_10_17.md` and `docs/CUSTOMER_FIREBASE_PHASE_C2_TEST_READINESS_2026_10_17.md`.
- **Supabase backup docs:** https://supabase.com/docs/guides/platform/backups — managed daily backups depend on project plan; do not assume this project has an active downloadable backup.

**Next:** owner performs steps 2–8 on trusted isolated infrastructure and returns only the non-sensitive signed pass/fail attestation. Then an approved Customer A/B Android data and Storage isolation test can start, keeping 2Factor fallback active.
