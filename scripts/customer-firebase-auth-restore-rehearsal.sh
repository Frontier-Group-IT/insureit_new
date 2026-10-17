#!/usr/bin/env bash
# OPERATOR-HELD restore rehearsal: only into a disposable loopback GoTrue database.
# No decrypted Auth dump is ever written to a file.
set -Eeuo pipefail
umask 077
: "${INSUREIT_BACKUP_FILE:?Encrypted .dump.age archive required}"
: "${INSUREIT_BACKUP_AGE_IDENTITY:?Private age key must be owner-held and local}"
: "${INSUREIT_RESTORE_TEST_DB_URL:?Isolated, matching-schema PostgreSQL URL required}"
[[ "${INSUREIT_RESTORE_ISOLATED_ACK:-}" == 'I_CONFIRM_DISPOSABLE_AUTH_DB' ]] || {
  echo 'ERROR: isolated database acknowledgement required' >&2; exit 1;
}
case "$INSUREIT_RESTORE_TEST_DB_URL" in
  postgres://*'@127.0.0.1:'*|postgresql://*'@127.0.0.1:'*|\
  postgres://*'@localhost:'*|postgresql://*'@localhost:'*) ;;
  *) echo 'ERROR: refusing remote/non-Postgres restore target' >&2; exit 1 ;;
esac
[[ -f "$INSUREIT_BACKUP_FILE" && -f "$INSUREIT_BACKUP_AGE_IDENTITY" ]] || {
  echo 'ERROR: local encrypted archive or key missing' >&2; exit 1;
}
for command in age pg_restore psql sha256sum; do
  command -v "$command" >/dev/null || { echo "ERROR: missing $command" >&2; exit 1; }
done
# Require a portable checksum manifest alongside the encrypted archive.
archive_dir="$(cd "$(dirname "$INSUREIT_BACKUP_FILE")" && pwd -P)"
archive_name="$(basename "$INSUREIT_BACKUP_FILE")"
[[ -f "$archive_dir/$archive_name.sha256" ]] || {
  echo 'ERROR: missing checksum manifest' >&2; exit 1;
}
(cd "$archive_dir" && sha256sum -c --status "$archive_name.sha256") || {
  echo 'ERROR: encrypted archive checksum verification failed' >&2; exit 1;
}
# Validate actual TCP server address, not just text within the URL.
server_ip="$(psql "$INSUREIT_RESTORE_TEST_DB_URL" -X -v ON_ERROR_STOP=1 -Atqc \
  'select coalesce(inet_server_addr()::text,'''')')"
[[ "$server_ip" == '127.0.0.1' || "$server_ip" == '::1' ]] || {
  echo 'ERROR: restore connection is not loopback' >&2; exit 1;
}
# Never import into an Auth database with existing users or identities.
existing="$(psql "$INSUREIT_RESTORE_TEST_DB_URL" -X -v ON_ERROR_STOP=1 -Atqc \
  'select (select count(*) from auth.users)::text || ''|'' || (select count(*) from auth.identities)::text')"
[[ "$existing" == '0|0' ]] || {
  echo 'ERROR: refusing restore into nonempty Auth identities' >&2; exit 1;
}
# Validate that decryption produces a readable pg_dump archive.
age -d -i "$INSUREIT_BACKUP_AGE_IDENTITY" "$INSUREIT_BACKUP_FILE" \
  | pg_restore --list >/dev/null
# Restore within one DB transaction; any failure aborts the import.
age -d -i "$INSUREIT_BACKUP_AGE_IDENTITY" "$INSUREIT_BACKUP_FILE" \
  | pg_restore --exit-on-error --single-transaction --no-owner --no-acl \
      --data-only --dbname="$INSUREIT_RESTORE_TEST_DB_URL"
# Verify that the restored GoTrue identities exist without printing records.
psql "$INSUREIT_RESTORE_TEST_DB_URL" -X -v ON_ERROR_STOP=1 -Atqc \
  'select count(*) from auth.users' >/dev/null
echo 'PASS: encrypted archive decrypted and imported into empty local Auth schema.'
echo 'NOT YET VERIFIED: original login, refresh/session, exact UUID, identity linkage,'
echo 'matching GoTrue migration version and complete recovery. Review these separately.'
