#!/usr/bin/env python3
"""Exact archived COPY row parity in managed target; no customer data logged.

Only for reviewed, manual isolated R4 execution after strict atomic pg_restore.
It checks selected application + auth destinations, not deliberately deferred
Storage/Realtime/Vault/migration data or service semantics.
"""
from pathlib import Path
import os
import ssl
import sys

from managed_recovery_preflight import checked_target_connection
from prepare_managed_sql_restore_list import APP_SCHEMAS
from verify_postgres_v2_rows import archive_counts

def verify_selected(data_sql, target_url):
    import psycopg
    from psycopg import sql

    data_path = Path(data_sql)
    if not data_path.is_file():
        raise ValueError("Private data-only archive extraction missing")
    counts = archive_counts(data_path)
    expected = {
        (schema, name): count
        for (schema, name), count in counts.items()
        if schema in APP_SCHEMAS or schema == "auth"
    }
    if sum(schema == "public" for schema, _ in expected) < 150:
        raise ValueError("Incomplete archived application COPY coverage")
    if sum(schema == "auth" for schema, _ in expected) < 20:
        raise ValueError("Incomplete archived Auth COPY coverage")
    ca = ssl.get_default_verify_paths().cafile
    if not ca or not Path(ca).is_file():
        raise ValueError("System TLS trust unavailable")
    params = checked_target_connection(target_url)
    mismatches = 0
    total_rows = 0
    with psycopg.connect(
        **params, sslmode="verify-full", sslrootcert=ca,
        options="-c default_transaction_read_only=on",
        connect_timeout=12, autocommit=True,
    ) as connection:
        with connection.cursor() as cur:
            cur.execute("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY")
            try:
                for (schema, table), archive_rows in sorted(expected.items()):
                    cur.execute(
                        sql.SQL("SELECT count(*) FROM {}.{}").format(
                            sql.Identifier(schema), sql.Identifier(table)))
                    actual = cur.fetchone()[0]
                    mismatches += actual != archive_rows
                    total_rows += actual
                cur.execute(
                    "SELECT count(*) FILTER (WHERE c.relrowsecurity),"
                    " count(*) FROM pg_catalog.pg_class c"
                    " JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace"
                    " WHERE c.relkind IN ('r','p') AND n.nspname='public'"
                )
                rls_enabled, table_count = cur.fetchone()
                cur.execute(
                    "SELECT n.nspname, count(*) FROM pg_catalog.pg_policy p"
                    " JOIN pg_catalog.pg_class c ON c.oid=p.polrelid"
                    " JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace"
                    " WHERE n.nspname IN ('public','storage')"
                    " GROUP BY n.nspname"
                )
                policies = dict(cur.fetchall())
                cur.execute(
                    "SELECT count(*) FROM pg_catalog.pg_trigger t"
                    " JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid"
                    " JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace"
                    " WHERE n.nspname='auth' AND c.relname='users'"
                    " AND NOT t.tgisinternal AND t.tgenabled <> 'D'"
                )
                auth_triggers = cur.fetchone()[0]
            finally:
                cur.execute("ROLLBACK")
    print(
        "TARGET MANAGED SQL RESTORE CHECK:"
        f" selected_copy_targets={len(expected)}"
        f" restored_rows={total_rows}"
        f" mismatched_tables={mismatches}"
        f" public_tables={table_count}"
        f" public_rls_tables={rls_enabled}"
        f" public_policies={policies.get('public',0)}"
        f" storage_policies={policies.get('storage',0)}"
        f" auth_user_triggers={auth_triggers}"
    )
    if (mismatches or table_count < 150 or rls_enabled != table_count
            or policies.get("public", 0) < 200
            or policies.get("storage", 0) < 30
            or auth_triggers != 1):
        raise RuntimeError("R4 SQL parity/permission structures not proved")
    print("R4 SELECTED APP+AUTH SQL ROW PARITY PASSED; "
          "FULL MANAGED SERVICE/OWNER/ROLE/STORAGE NOT CERTIFIED")


if __name__ == "__main__":
    try:
        if len(sys.argv) != 2:
            raise ValueError("Usage: verify_managed_sql_rows.py PRIVATE_DATA_ONLY_SQL")
        verify_selected(sys.argv[1], os.environ["INSUREIT_RECOVERY_DATABASE_URL"])
    except Exception as exc:
        print(f"R4 MANAGED SQL VERIFICATION FAILED: category={type(exc).__name__};"
              " private SQL and customer data withheld", file=sys.stderr)
        raise SystemExit(1)
