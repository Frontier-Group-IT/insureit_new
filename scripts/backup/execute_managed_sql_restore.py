#!/usr/bin/env python3
"""Explicit, target-only managed SQL replay into isolated INSUREIT Supabase.

Only invoked from the reviewed protected, manual R4 workflow. Fails closed on
wrong DB, dirty target, missing archive/list, failed PostgreSQL restore.
Suppresses sensitive stderr/SQL; no source DB or production environment access.
"""
import os
from pathlib import Path
import ssl
import subprocess
import sys

from managed_recovery_preflight import (
    checked_target_connection, query_target, TARGET_REF,
)

POSTGRES_IMAGE = "postgres:17-bookworm"


def validate_target(url):
    params = checked_target_connection(url)
    baseline = query_target(params)
    public_tables = sum(schema == "public" for schema, _ in baseline["tables"])
    if (public_tables or baseline["auth_users"] or baseline["identities"]
            or baseline["buckets"] or baseline["objects"]):
        raise RuntimeError("Recovery target not empty; refusing rerun/overwrite")
    if baseline["managed_policies"].get("storage", 0):
        raise RuntimeError("Managed Storage custom policies already exist")
    if baseline["managed_triggers"].get("auth", 0):
        raise RuntimeError("Auth customization trigger already exists")
    return params


def run_restore(directory, url, dry_run=False):
    directory = Path(directory).resolve()
    backup = directory / "database.dump"
    entries = directory / "approved-restore-list.txt"
    if not backup.is_file() or not entries.is_file():
        raise ValueError("Verified archive and approved TOC list required")
    if backup.stat().st_size < 1000 or not 0 < entries.stat().st_size < 32 * 1024 * 1024:
        raise ValueError("Unexpected private restore inputs")
    params = validate_target(url)
    if dry_run:
        print("TARGET MANAGED SQL R4: validated archive/list and empty target; NO IMPORT")
        return
    if os.getenv("RECOVERY_APPROVED_TARGET_REF") != TARGET_REF:
        raise RuntimeError("Target identity not independently acknowledged")
    if os.getenv("RECOVERY_OPERATOR_CONFIRMED") != "ISOLATED_ONLY":
        raise RuntimeError("Explicit operator isolation confirmation absent")
    if os.getenv("RECOVERY_EXPECTED_DB_SNAPSHOT", "") == "":
        raise RuntimeError("An exact authenticated R2 snapshot lock is mandatory")

    ca_file = "/etc/ssl/certs/ca-certificates.crt"
    parent = ssl.get_default_verify_paths().cafile
    if not parent or not Path(parent).is_file():
        raise RuntimeError("Host system CA bundle unavailable")
    # Docker receives only environment variable *names* on argv. Never pass
    # credential URL or password on the process command line.
    env = dict(os.environ)
    env.update({
        "PGHOST": params["host"],
        "PGPORT": str(params["port"]),
        "PGDATABASE": params["dbname"],
        "PGUSER": params["user"],
        "PGPASSWORD": params["password"],
        "PGSSLMODE": "verify-full",
        "PGSSLROOTCERT": ca_file,
    })
    vars_to_forward = ("PGHOST", "PGPORT", "PGDATABASE", "PGUSER",
                       "PGPASSWORD", "PGSSLMODE", "PGSSLROOTCERT")
    cmd = [
        "docker", "run", "--rm", "--network", "host",
        "--read-only", "--tmpfs", "/tmp:rw,nosuid,nodev,size=32m",
        "--mount", f"type=bind,source={directory},target=/archive,readonly",
    ]
    for v in vars_to_forward:
        cmd += ["--env", v]
    cmd += [
        POSTGRES_IMAGE, "pg_restore", "--dbname=postgres",
        "--use-list=/archive/approved-restore-list.txt",
        "--single-transaction", "--exit-on-error",
        "--no-owner", "--no-acl",
        "/archive/database.dump",
    ]
    # pg_restore is always atomic (single transaction). Never --clean.
    # stderr may include SQL/filenames, so keep all output in private runner
    # files; the Actions log contains only summarized failure category.
    with (directory / "managed-restore-private.log").open("xb") as log:
        result = subprocess.run(cmd, stdout=log, stderr=subprocess.STDOUT,
                                timeout=1800, env=env, check=False)
    if result.returncode:
        raise RuntimeError("Protected SQL restore rolled back (inspect private runner log)")
    print("TARGET MANAGED SQL R4 ATOMIC RESTORE: completed; verify row parity and policies next")


if __name__ == "__main__":
    try:
        if len(sys.argv) != 3 or sys.argv[1] not in ("--dry-run", "--apply"):
            raise ValueError("Usage: execute_managed_sql_restore.py --dry-run|--apply PRIVATE_DIR")
        run_restore(sys.argv[2], os.environ["INSUREIT_RECOVERY_DATABASE_URL"],
                    dry_run=sys.argv[1] == "--dry-run")
    except Exception as exc:
        print(f"TARGET MANAGED SQL RESTORE STOPPED: category={type(exc).__name__};"
              " SQL, customer rows and credentials withheld", file=sys.stderr)
        raise SystemExit(1)
