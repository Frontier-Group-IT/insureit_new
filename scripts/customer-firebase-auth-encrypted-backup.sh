#!/usr/bin/env bash
# Operator-controlled backup. NEVER run from CI, never upload an artifact to GitHub.
# Requires a locally available DB connection and recipient-controlled age public key.
set -euo pipefail
umask 077
: "${INSUREIT_BACKUP_DB_URL:?Supply direct/compatible Postgres connection via a secure shell environment}"
: "${INSUREIT_BACKUP_AGE_RECIPIENT:?Supply age public recipient key for independent secure storage}"
: "${INSUREIT_BACKUP_DIR:?Supply a secure output directory outside the repository}"
if [[ "${INSUREIT_BACKUP_DB_URL}" != postgres* ]]; then echo 'Refusing non-Postgres connection' >&2; exit 1; fi
for command in pg_dump age sha256sum; do command -v "$command" >/dev/null || { echo "Missing $command" >&2; exit 1; }; done
mkdir -p -- "$INSUREIT_BACKUP_DIR"
chmod 700 "$INSUREIT_BACKUP_DIR"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
out="$INSUREIT_BACKUP_DIR/insureit-auth-$timestamp.dump.age"
if [[ -e "$out" ]]; then echo 'Refusing overwrite' >&2; exit 1; fi
# Stream the full Auth schema through encryption; no plaintext dump on disk.
# The private decryption key must be retained separately and NEVER passed to CI.
pg_dump --dbname="$INSUREIT_BACKUP_DB_URL" --format=custom --no-owner --no-acl --schema=auth \
 | age -r "$INSUREIT_BACKUP_AGE_RECIPIENT" -o "$out"
chmod 600 "$out"
sha256sum "$out" > "$out.sha256"
chmod 600 "$out.sha256"
echo 'ENCRYPTED AUTH BACKUP WRITTEN. Restore rehearsal and independent offsite retention are REQUIRED before any Auth mutation.'
echo 'Never commit/upload the .age file or the decryption key to GitHub or chat.'
