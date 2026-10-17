# INSUREIT Firebase migration — protected Auth backup and recovery
2026-10-16 | Draft PR #3199 | NO PRODUCTION BACKUP CREATED

## Production assessment
Connected Supabase project `ilzhsfqqjyppzzvfscmh` is active (PostgreSQL 17). The available project connector does not expose a backup download or protected database credentials, so neither a production backup nor its encryption, retention and restoration can honestly be asserted from this chat. A database API/SQL Editor query is not an acceptable substitute for a recoverable backup. Do not print Auth rows, password hashes, service keys, or decryption material in logs/chats/commits.

## Operator-controlled approach
1. Set up recipient-controlled age encryption keypair, store private key separately in a secure password manager/offline vault. NEVER store key in GitHub Actions or attach to tickets.
2. From a trusted workstation with a privileged **read-only** or otherwise appropriately authorized PostgreSQL direct connection that can read the `auth` schema, run `scripts/customer-firebase-auth-encrypted-backup.sh`. It streams pg_dump of the complete Auth schema through age encryption, avoids a plaintext on-disk dump and generates a SHA-256 manifest. Place encrypted output outside the repository and separately in access-restricted offsite storage.
3. Verify file integrity, recover private key out-of-band, and rehearse restoration with `scripts/customer-firebase-auth-restore-rehearsal.sh` against a **disposable loopback** Supabase-compatible database, never the production URL. Verify original password login for consenting synthetic fixture, same UUID, identities, role, profile relationships and migration rollback. PostgreSQL version and GoTrue schema must match.
4. Record only hash, test timestamp and outcome as reviewed migration evidence. If restore fails or private key cannot decrypt, backup is NOT verified and no live Auth user may change.
5. If a direct DB credential or safe execution environment is not available, require owner-assisted provision of a secure execution channel or paid managed backup option; do not manufacture credentials or persist production Auth data in this chat.

## Test evidence
- Disposable atomic UID enrollment integration passed: GitHub Actions #38881251117, including service-only RPC, idempotency/audit and rollback, on source c783e2c9.
- Disposable *strong* actual encrypted-password-hash restoration failed #38881251029 at protected `auth` schema access (`permission denied for schema auth`). This is **not a restore pass**.
- Earlier synthetic known-password reset tests passed, but a known test password can be reassigned through Admin API and is NOT a proof of restoration of an unknown original production password hash.
- Schema backup and restore scripts have not been run with any production data, nor has their end-to-end backup/restore path been validated.
- No production Auth writes, schema changes, UID link approvals or rollout performed.

## Safeguards
Never use SQL Editor CSV exports as a complete Auth recovery snapshot. Never use service-role REST to fetch password hashes. Never write raw password hashes or decrypted dumps to app logs, GitHub Actions artifacts, PRs or public cloud storage. No customer migration, Firebase bridge activation or 2Factor removal until the actual restore rehearsal passes and is independently reviewed.
