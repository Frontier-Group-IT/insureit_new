#!/usr/bin/env bash
# Operator-held production Auth backup. Never run in CI with real credentials.
# Encrypted dump stays outside the repo; private decryption key stays offline.
set -Eeuo pipefail
umask 077
: "${INSUREIT_BACKUP_DB_URL:?Use an owner-held privileged PostgreSQL connection}"
: "${INSUREIT_BACKUP_AGE_RECIPIENT:?Use an age X25519 public recipient}"
: "${INSUREIT_BACKUP_DIR:?Use an encrypted-backup directory outside the repository}"
case "$INSUREIT_BACKUP_DB_URL" in
  postgres://*|postgresql://*) ;;
  *) echo 'ERROR: PostgreSQL connection URL required' >&2; exit 1 ;;
esac
[[ "$INSUREIT_BACKUP_AGE_RECIPIENT" =~ ^age1[a-z0-9]+$ ]] || {
  echo 'ERROR: age X25519 public recipient required' >&2; exit 1;
}
# Fail closed if the URL is not for the documented INSUREIT project. A pooler
# URL normally includes the project ref in its username; direct URL in host.
project_ref='ilzhsfqqjyppzzvfscmh'
if [[ "${INSUREIT_BACKUP_DISPOSABLE_LOCAL_TEST:-}" == 'YES_SYNTHETIC_ONLY' ]]; then
  [[ "$INSUREIT_BACKUP_DB_URL" == *'@127.0.0.1:'* ||
     "$INSUREIT_BACKUP_DB_URL" == *'@localhost:'* ]] || {
       echo 'ERROR: synthetic override requires loopback URL' >&2; exit 1;
     }
else
  [[ "$INSUREIT_BACKUP_DB_URL" == *"$project_ref"* ]] || {
    echo 'ERROR: connection URL does not identify INSUREIT project' >&2; exit 1;
  }
fi
for command in pg_dump age sha256sum; do
  command -v "$command" >/dev/null || { echo "ERROR: missing $command" >&2; exit 1; }
done
mkdir -p -- "$INSUREIT_BACKUP_DIR"
chmod 700 -- "$INSUREIT_BACKUP_DIR"
output_dir="$(cd "$INSUREIT_BACKUP_DIR" && pwd -P)"
repo_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -n "$repo_root" && "$output_dir/" == "$repo_root/"* ]]; then
  echo 'ERROR: backup output directory must be outside the Git repository' >&2
  exit 1
fi
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
filename="insureit-auth-$stamp-$$.dump.age"
out="$output_dir/$filename"
if [[ -e "$out" || -e "$out.sha256" ]]; then
  echo 'ERROR: refusing backup overwrite' >&2; exit 1
fi
success=false
cleanup() {
  if [[ "$success" != true ]]; then
    rm -f -- "$out" "$out.sha256"
  fi
}
trap cleanup EXIT
# pg_dump only reads the Auth schema. pipefail catches either process failing.
pg_dump --dbname="$INSUREIT_BACKUP_DB_URL" --format=custom --no-owner --no-acl --schema=auth \
  | age -r "$INSUREIT_BACKUP_AGE_RECIPIENT" -o "$out"
[[ -s "$out" ]] || { echo 'ERROR: encrypted file empty' >&2; exit 1; }
chmod 600 -- "$out"
# Manifest is relative, so the encrypted file + checksum can be relocated together.
(cd "$output_dir" && sha256sum "$filename" > "$filename.sha256")
chmod 600 -- "$out.sha256"
success=true
echo 'PASS: encrypted Auth archive and portable checksum manifest created.'
echo 'REQUIRED NEXT: independent encrypted offsite copy, private-key recovery and'
echo 'matching isolated GoTrue restore, including original account verification.'
echo 'Never upload the archive, DB URL, encryption identity, password hashes or tokens to chat/CI.'
