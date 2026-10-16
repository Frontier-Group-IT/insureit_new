#!/usr/bin/env bash
# Restore rehearsal on an OPERATOR-OWNED DISPOSABLE database, never production.
set -euo pipefail
umask 077
: "${INSUREIT_BACKUP_FILE:?Encrypted Auth .dump.age file required}"
: "${INSUREIT_BACKUP_AGE_IDENTITY:?Path to local age private key (never CI)}"
: "${INSUREIT_RESTORE_TEST_DB_URL:?Connection to empty disposable PostgreSQL database}"
case "$INSUREIT_RESTORE_TEST_DB_URL" in
  *ilzhsfqqjyppzzvfscmh*|*db.*.supabase.co*|*pooler.supabase.com*)
    echo 'Refusing managed/production-looking restore destination' >&2; exit 1 ;;
esac
[[ "$INSUREIT_RESTORE_TEST_DB_URL" == postgres* ]] || exit 1
[[ -f "$INSUREIT_BACKUP_FILE" && -f "$INSUREIT_BACKUP_AGE_IDENTITY" ]] || exit 1
for cmd in age pg_restore psql sha256sum; do command -v "$cmd" >/dev/null || exit 1; done
sha256sum -c "$INSUREIT_BACKUP_FILE.sha256"
scratch="$(mktemp -d)"
trap 'rm -rf "$scratch"' EXIT
chmod 700 "$scratch"
age -d -i "$INSUREIT_BACKUP_AGE_IDENTITY" -o "$scratch/auth.dump" "$INSUREIT_BACKUP_FILE"
# Inspect manifest without disclosing rows; suppress dump contents in logs.
pg_restore --list "$scratch/auth.dump" >/dev/null
# The disposable database must already have compatible Supabase Auth schema,
# GoTrue version, and privileges. This is NOT a general empty-Postgres restore.
test "$(psql "$INSUREIT_RESTORE_TEST_DB_URL" -Atqc "select count(*) from auth.users")" = "0" || {
 echo 'Refusing restore to nonempty Auth database' >&2; exit 1;
}
pg_restore --exit-on-error --no-owner --no-acl --data-only \
  --dbname="$INSUREIT_RESTORE_TEST_DB_URL" "$scratch/auth.dump"
psql "$INSUREIT_RESTORE_TEST_DB_URL" -Atqc "select count(*) from auth.users" >/dev/null
echo 'Auth data imported into disposable environment; now run original-login, UUID, identity and cross-account recovery acceptance tests before considering backup verified.'
