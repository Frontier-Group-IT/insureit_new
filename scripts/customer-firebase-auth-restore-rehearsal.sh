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
# Validate the parsed destination hostname; Docker port forwarding can make
# inet_server_addr() non-loopback even for 127.0.0.1 client connections.
command -v python3 >/dev/null || { echo 'ERROR: missing python3' >&2; exit 1; }
restore_host="$(INSUREIT_RESTORE_TEST_DB_URL="$INSUREIT_RESTORE_TEST_DB_URL" python3 - <<'PY'
import os
import urllib.parse
url = urllib.parse.urlsplit(os.environ["INSUREIT_RESTORE_TEST_DB_URL"])
if url.scheme not in {"postgres", "postgresql"} or not url.hostname or not url.port:
    raise SystemExit(2)
print(url.hostname.lower())
PY
)"
[[ "$restore_host" == '127.0.0.1' || "$restore_host" == 'localhost' || "$restore_host" == '::1' ]] || {
  echo 'ERROR: restore destination host is not loopback' >&2; exit 1;
}
# Never import into an Auth database with existing users or identities.
existing="$(psql "$INSUREIT_RESTORE_TEST_DB_URL" -X -v ON_ERROR_STOP=1 -Atqc \
  "select (select count(*) from auth.users)::text || '|' || (select count(*) from auth.identities)::text")"
[[ "$existing" == '0|0' ]] || {
  echo 'ERROR: refusing restore into nonempty Auth identities' >&2; exit 1;
}
# Require a matching target GoTrue migration history. The CI synthetic fixture
# is the only exception (it still requires the loopback+disposable acknowledgement).
if [[ "${INSUREIT_BACKUP_DISPOSABLE_LOCAL_TEST:-}" != 'YES_SYNTHETIC_ONLY' ]]; then
  go_true_version="$(psql "$INSUREIT_RESTORE_TEST_DB_URL" -X -v ON_ERROR_STOP=1 -Atqc \
    "select count(*)::text || '|' || coalesce(max(version::text),'') from auth.schema_migrations")"
  auth_table_count="$(psql "$INSUREIT_RESTORE_TEST_DB_URL" -X -v ON_ERROR_STOP=1 -Atqc \
    "select count(*) from information_schema.tables where table_schema='auth' and table_type='BASE TABLE'")"
  [[ "$go_true_version" == '82|20260831180000' && "$auth_table_count" == '27' ]] || {
    echo 'ERROR: local GoTrue schema/migrations do not match inspected production baseline' >&2
    exit 1
  }
fi
# The encrypted archive retains the ENTIRE source Auth schema, including GoTrue
# migration bookkeeping. In a matching target these migrations ALREADY EXIST.
# Build a temporary archive TOC (object names only, NO user rows/credentials),
# and omit only the pre-seeded migration-history TABLE DATA during import.
toc="$(mktemp)"
trap 'rm -f -- "$toc"' EXIT
age -d -i "$INSUREIT_BACKUP_AGE_IDENTITY" "$INSUREIT_BACKUP_FILE" \
  | pg_restore --list > "$toc"
grep -Eq ' TABLE DATA auth users ' "$toc" || {
  echo 'ERROR: archive missing auth.users table data' >&2; exit 1;
}
grep -Eq ' TABLE DATA auth identities ' "$toc" || {
  echo 'ERROR: archive missing auth.identities table data' >&2; exit 1;
}
sed -i '/ TABLE DATA auth schema_migrations /s/^/;/' "$toc"
# Data-only archives can list auth.identities before auth.users. Disable
# FK triggers ONLY for this single disposable restore transaction; pg_restore
# re-enables them before commit. This must NEVER be used against production.
age -d -i "$INSUREIT_BACKUP_AGE_IDENTITY" "$INSUREIT_BACKUP_FILE" \
  | pg_restore --exit-on-error --single-transaction --no-owner --no-acl \
      --disable-triggers --data-only --use-list="$toc" \
      --dbname="$INSUREIT_RESTORE_TEST_DB_URL"
# Verify that the restored GoTrue identities exist without printing records.
restored="$(psql "$INSUREIT_RESTORE_TEST_DB_URL" -X -v ON_ERROR_STOP=1 -Atqc \
  'select count(*) from auth.users')"
[[ "$restored" =~ ^[1-9][0-9]*$ ]] || {
  echo 'ERROR: no Auth user records were restored' >&2; exit 1;
}
# Since FK triggers were disabled during import, independently verify the primary
# user-to-identity relationship before claiming even a technical restore pass.
orphan_identities="$(psql "$INSUREIT_RESTORE_TEST_DB_URL" -X -v ON_ERROR_STOP=1 -Atqc \
  'select count(*) from auth.identities i left join auth.users u on u.id=i.user_id where u.id is null')"
[[ "$orphan_identities" == '0' ]] || {
  echo 'ERROR: orphaned Auth identities detected after isolated restore' >&2; exit 1;
}
echo 'PASS: encrypted archive imported into isolated Auth; user-identity references checked.'
echo 'NOT YET VERIFIED: original login, refresh/session, exact UUID, identity linkage,'
echo 'matching GoTrue migration version and complete recovery. Review these separately.'
