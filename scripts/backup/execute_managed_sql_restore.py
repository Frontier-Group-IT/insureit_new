#!/usr/bin/env python3
"""Target-locked managed SQL recovery with single-transaction security checks.

The authenticated R2 dump is restored only in a human-approved manual job.
First render a PRIVATE SQL file in network-disabled Docker; then psql applies
schema/data and *restrictive privileges + RLS checks* in ONE transaction.
No production URL, R2 write, public customer data artifact, or --clean allowed.
"""
import os
import re
from pathlib import Path
import subprocess
import sys

from managed_recovery_preflight import (
    checked_target_connection, query_target, TARGET_REF, isolated_ssl_root_cert,
)

POSTGRES_IMAGE = "postgres:17-bookworm"
SECURITY_GUARD = """
-- These statements execute BEFORE COMMIT inside psql --single-transaction.
-- Managed Auth trigger / Storage RLS policies are intentionally deferred:
-- the target postgres role does not own those managed tables.
-- No customer access to newly restored SECURITY DEFINER functions by default.
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;
DO $insureit_target_guard$
DECLARE
  app_tables integer;
  enabled_rls integer;
  policy_count integer;
  storage_policies integer;
  custom_auth_triggers integer;
  definer_exposure integer;
BEGIN
  SELECT count(*), count(*) FILTER (WHERE c.relrowsecurity)
    INTO app_tables, enabled_rls
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relkind IN ('r','p');
  SELECT count(*) INTO policy_count FROM pg_catalog.pg_policy p
    JOIN pg_catalog.pg_class c ON c.oid=p.polrelid
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public';
  SELECT count(*) INTO storage_policies FROM pg_catalog.pg_policy p
    JOIN pg_catalog.pg_class c ON c.oid=p.polrelid
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='storage';
  SELECT count(*) INTO custom_auth_triggers FROM pg_catalog.pg_trigger t
    JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='auth' AND c.relname='users'
     AND NOT t.tgisinternal AND t.tgenabled <> 'D';
  SELECT count(*) INTO definer_exposure
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.prosecdef AND
         (pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE') OR
          pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE'));
  IF app_tables < 150 OR app_tables <> enabled_rls OR policy_count < 200
     OR storage_policies <> 0 OR custom_auth_triggers <> 0
     OR (SELECT count(*) FROM auth.users) < 1
     OR definer_exposure <> 0
  THEN
    RAISE EXCEPTION 'Isolated managed SQL restore security baseline failed';
  END IF;
END $insureit_target_guard$;
"""


def redacted_sqlstate(logfile):
    """Never print psql's private log, SQL, row values or relation names."""
    try:
        # Only the final 64 KiB of a private runner-local file is needed.
        with Path(logfile).open("rb") as handle:
            handle.seek(0, os.SEEK_END)
            handle.seek(max(0, handle.tell() - 65536))
            tail = handle.read().decode("utf-8", errors="replace")
    except OSError:
        return "UNAVAILABLE"
    # psql -v VERBOSITY=sqlstate reduces ERROR lines to five-character codes.
    codes = re.findall(r"\\b(?:ERROR|FATAL):\\s*([0-9A-Z]{5})\\b", tail)
    return codes[-1] if codes else "UNAVAILABLE"


def validate_target(url):
    params = checked_target_connection(url)
    baseline = query_target(params)
    public_tables = sum(schema == "public" for schema, _ in baseline["tables"])
    if (public_tables or baseline["auth_users"] or baseline["identities"]
            or baseline["buckets"] or baseline["objects"]):
        raise RuntimeError("Recovery target not empty; refusing overwrite/retry")
    if baseline["managed_policies"].get("storage", 0):
        raise RuntimeError("Managed Storage custom policies already present")
    if baseline["managed_triggers"].get("auth", 0):
        raise RuntimeError("Auth custom trigger already present")
    return params


def run_restore(directory, url, dry_run=False):
    directory = Path(directory).resolve()
    backup = directory / "database.dump"
    entries = directory / "approved-restore-list.txt"
    if not backup.is_file() or not entries.is_file():
        raise ValueError("Verified archive and approved TOC required")
    if backup.stat().st_size < 1000 or not 0 < entries.stat().st_size < 32 * 1024 * 1024:
        raise ValueError("Unexpected private restore inputs")
    params = validate_target(url)
    if dry_run:
        print("TARGET MANAGED SQL R4: pristine target / authenticated archive selected; NO IMPORT")
        return
    if os.getenv("RECOVERY_APPROVED_TARGET_REF") != TARGET_REF:
        raise RuntimeError("Target identity acknowledgement missing")
    if os.getenv("RECOVERY_OPERATOR_CONFIRMED") != "ISOLATED_ONLY":
        raise RuntimeError("Isolation acknowledgement missing")
    if not os.getenv("RECOVERY_EXPECTED_DB_SNAPSHOT", ""):
        raise RuntimeError("Mandatory authenticated archive snapshot lock absent")
    sqlfile = directory / "private-restore.sql"
    securityfile = directory / "private-security-guard.sql"
    if sqlfile.exists() or securityfile.exists():
        raise RuntimeError("Unexpected preexisting private SQL")
    securityfile.write_text(SECURITY_GUARD, encoding="utf-8")
    securityfile.chmod(0o600)

    # Render only approved TOC items to private plaintext SQL. This command
    # runs --network none, without ANY database credentials.
    extract_cmd = [
        "docker", "run", "--rm", "--network", "none",
        "--user", f"{os.getuid()}:{os.getgid()}",
        "--mount", f"type=bind,source={directory},target=/archive",
        "--entrypoint", "pg_restore",
        POSTGRES_IMAGE, "--no-owner", "--no-acl",
        "--use-list=/archive/approved-restore-list.txt",
        "--file=/archive/private-restore.sql",
        "/archive/database.dump",
    ]
    with (directory / "private-extract.log").open("xb") as log:
        proc = subprocess.run(
            extract_cmd, stdout=log, stderr=subprocess.STDOUT,
            timeout=600, check=False,
        )
    if proc.returncode or not sqlfile.is_file() or sqlfile.stat().st_size < 1000:
        raise RuntimeError("Filtered SQL extraction failed without target write")
    sqlfile.chmod(0o600)

    # Never put URL, token or password in argv or public Actions logs.
    environment = dict(os.environ)
    environment.update({
        "PGHOST": params["host"], "PGPORT": str(params["port"]),
        "PGDATABASE": params["dbname"], "PGUSER": params["user"],
        "PGPASSWORD": params["password"],
        "PGSSLMODE": "verify-full",
        "PGSSLROOTCERT": "/etc/ssl/insureit-isolated-supabase-ca.crt",
    })
    pg_vars = ("PGHOST", "PGPORT", "PGDATABASE", "PGUSER", "PGPASSWORD",
               "PGSSLMODE", "PGSSLROOTCERT")
    # -1 wraps BOTH SQL restore and privilege/RLS guard in ONE transaction.
    # Any error rolls back app rows, Auth rows, policies and functions.
    # The CA PEM is downloaded from the isolated Supabase project into
    # protected GitHub environment secret only. Use a private, ephemeral file
    # with an explicit read-only mount for psql. Never downgrade verify-full.
    with isolated_ssl_root_cert() as ca_path:
        apply_cmd = [
            "docker", "run", "--rm", "--network", "host", "--read-only",
            "--tmpfs", "/tmp:rw,nosuid,nodev,size=32m",
            "--mount", f"type=bind,source={directory},target=/archive,readonly",
            "--mount", (
                f"type=bind,source={ca_path},"
                "target=/etc/ssl/insureit-isolated-supabase-ca.crt,readonly"
            ),
        ]
        for name in pg_vars:
            apply_cmd += ["--env", name]
        apply_cmd += [
            "--entrypoint", "psql", POSTGRES_IMAGE,
            "--no-psqlrc", "--single-transaction",
            "--variable", "ON_ERROR_STOP=1",
            "--variable", "VERBOSITY=sqlstate", "--quiet",
            "--dbname=postgres",
            "--file=/archive/private-restore.sql",
            "--file=/archive/private-security-guard.sql",
        ]
        private_log = directory / "managed-restore-private.log"
        with private_log.open("xb") as log:
            proc = subprocess.run(
                apply_cmd, stdout=log, stderr=subprocess.STDOUT,
                timeout=1800, env=environment, check=False,
            )
        if proc.returncode:
            print("R4 MANAGED SQL APPLY FAILED:"
                  f" sqlstate={redacted_sqlstate(private_log)}"
                  " confidential details withheld", file=sys.stderr)
            raise RuntimeError("Atomic managed SQL import/security check FAILED and rolled back")
    print("TARGET MANAGED SQL R4 ATOMIC RESTORE + RESTRICTIVE SECURITY GUARDS PASSED;"
          " independent snapshot/permission parity audit follows")


if __name__ == "__main__":
    try:
        if len(sys.argv) != 3 or sys.argv[1] not in ("--dry-run", "--apply"):
            raise ValueError("Usage: execute_managed_sql_restore.py --dry-run|--apply PRIVATE_DIR")
        run_restore(sys.argv[2], os.environ["INSUREIT_RECOVERY_DATABASE_URL"],
                    dry_run=sys.argv[1] == "--dry-run")
    except Exception as exc:
        print(f"TARGET MANAGED SQL RESTORE STOPPED: category={type(exc).__name__};"
              " confidential SQL and customer data withheld", file=sys.stderr)
        raise SystemExit(1)
