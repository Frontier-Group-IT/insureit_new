#!/usr/bin/env python3
"""R5 READ-ONLY check of the SQL-restored, isolated Supabase target.

Protected GitHub environment only. No Storage API writes, no SQL DDL/DML,
no production credentials. Reuses R4's strict destination allowlist and
private trusted project root CA / verify-full read-only transaction.
"""
import os
import sys

from managed_recovery_preflight import checked_target_connection, query_target

TARGET_APP_TABLES = 183
TARGET_AUTH_USERS = 87
TARGET_AUTH_IDENTITIES = 91


def verify_r5_target(state):
    """Never print names, rows, paths, service credentials or URLs."""
    public_count = sum(namespace == "public" for namespace, _ in state["tables"])
    checks = (
        public_count == TARGET_APP_TABLES,
        state["auth_users"] == TARGET_AUTH_USERS,
        state["identities"] == TARGET_AUTH_IDENTITIES,
        state["buckets"] == 0,
        state["objects"] == 0,
        state["exposed_public_definers"] == 0,
        state["managed_policies"].get("storage", 0) == 0,
        state["managed_triggers"].get("auth", 0) == 0,
    )
    if not all(checks):
        raise RuntimeError("Isolated SQL-restored target no longer matches R5 baseline")
    return public_count


def run():
    url = os.environ["INSUREIT_RECOVERY_DATABASE_URL"]
    state = query_target(checked_target_connection(url))
    public_count = verify_r5_target(state)
    print("ISOLATED R5 STORAGE TARGET PRECHECK PASSED:"
          f" restored_public_tables={public_count}"
          f" auth_users={state['auth_users']}"
          f" auth_identities={state['identities']}"
          " target_storage_buckets=0 target_storage_objects=0"
          " callable_public_definers=0 target_sql_read_only=1"
          " no_production_connection=1 no_storage_upload=1", flush=True)


if __name__ == "__main__":
    try:
        run()
    except Exception as exc:
        print(f"ISOLATED R5 STORAGE TARGET PRECHECK FAILED:"
              f" category={type(exc).__name__};"
              " credentials, source/customer identifiers withheld",
              file=sys.stderr)
        raise SystemExit(1) from None
