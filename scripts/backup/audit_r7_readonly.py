#!/usr/bin/env python3
"""R7 metadata-only, two-environment recovery check. No application data reads/writes.

Source and target run in different protected jobs; ONLY aggregate metadata crosses
jobs. Connection and SQL failures are intentionally redacted. Never invoke this
script with a service-role key or outside protected GitHub environments.
"""
import hashlib
import json
import os
import sys
from contextlib import nullcontext

from managed_recovery_preflight import checked_target_connection, isolated_ssl_root_cert
from prepare_pg_dump_connection import checked_connection as checked_source_connection

SOURCE_REF = "ilzhsfqqjyppzzvfscmh"
TARGET_REF = "klnodxnmlqbofolxxrsr"
SQL_SNAPSHOT = "20261117T041507Z"
STORAGE_SNAPSHOT = "20261116T225734Z"
KNOWN_SOURCE_DRIFT = "policy_intake_ai_processing_queue"


def snapshot_lock(env):
    if (env.get("R7_EXPECTED_SQL_SNAPSHOT") != SQL_SNAPSHOT or
            env.get("R7_EXPECTED_STORAGE_SNAPSHOT") != STORAGE_SNAPSHOT):
        raise ValueError("R7 historical restore markers differ from reviewed evidence")


def scalar(cur, sql):
    cur.execute(sql)
    return cur.fetchone()[0]


def catalog(cur):
    """Fixed SELECT-only, aggregate catalog inventory; never reads business rows."""
    cur.execute("SELECT table_name FROM information_schema.tables "
                "WHERE table_schema='public' AND table_type='BASE TABLE'")
    tables = {r[0] for r in cur.fetchall()}
    normalized = sorted(tables - {KNOWN_SOURCE_DRIFT})
    digest = hashlib.sha256("\n".join(normalized).encode()).hexdigest()
    metrics = {
        "public_tables": len(tables),
        "schema_digest_without_queue": digest,
        "has_recent_queue": int(KNOWN_SOURCE_DRIFT in tables),
        "auth_users": scalar(cur, "SELECT count(*) FROM auth.users"),
        "auth_identities": scalar(cur, "SELECT count(*) FROM auth.identities"),
        "storage_buckets": scalar(cur, "SELECT count(*) FROM storage.buckets"),
        "storage_public": scalar(cur, "SELECT count(*) FROM storage.buckets WHERE public"),
        "storage_objects": scalar(cur, "SELECT count(*) FROM storage.objects"),
        "storage_policies": scalar(cur, "SELECT count(*) FROM pg_policies WHERE schemaname='storage'"),
        "public_policies": scalar(cur, "SELECT count(*) FROM pg_policies WHERE schemaname='public'"),
        "auth_user_triggers": scalar(cur, "SELECT count(*) FROM pg_trigger t "
            "JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace "
            "WHERE n.nspname='auth' AND c.relname='users' "
            "AND NOT t.tgisinternal AND t.tgenabled<>'D'"),
        "realtime_publications": scalar(cur, "SELECT count(*) FROM pg_publication_tables "
            "WHERE pubname='supabase_realtime'"),
        "migrations": scalar(cur, "SELECT count(*) FROM supabase_migrations.schema_migrations"),
        "public_security_definers": scalar(cur, "SELECT count(*) FROM pg_proc p "
            "JOIN pg_namespace n ON n.oid=p.pronamespace "
            "WHERE n.nspname='public' AND p.prosecdef"),
    }
    return metrics


def target_details(cur):
    return {
        "sample_size_rows": scalar(cur, "SELECT count(*) FROM storage.objects "
            "WHERE metadata->>'size' ~ '^[0-9]+$'"),
        "sample_bytes": scalar(cur, "SELECT coalesce(sum((metadata->>'size')::bigint),0)::bigint "
            "FROM storage.objects WHERE metadata->>'size' ~ '^[0-9]+$'"),
        "unowned_objects": scalar(cur, "SELECT count(*) FROM storage.objects WHERE owner_id IS NULL"),
        "target_exposed_tables": scalar(cur, "SELECT count(*) FROM "
            "information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' "
            "AND (has_table_privilege('anon',quote_ident(table_schema)||'.'||quote_ident(table_name),'SELECT') "
            "OR has_table_privilege('authenticated',quote_ident(table_schema)||'.'||quote_ident(table_name),'SELECT'))"),
        "target_write_tables": scalar(cur, "SELECT count(*) FROM information_schema.tables "
            "WHERE table_schema='public' AND table_type='BASE TABLE' AND ("
            "has_table_privilege('anon',quote_ident(table_schema)||'.'||quote_ident(table_name),'INSERT,UPDATE,DELETE') OR "
            "has_table_privilege('authenticated',quote_ident(table_schema)||'.'||quote_ident(table_name),'INSERT,UPDATE,DELETE'))"),
        "public_rls_tables": scalar(cur, "SELECT count(*) FROM pg_class c "
            "JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' "
            "AND c.relkind IN ('r','p') AND c.relrowsecurity"),
    }


def read_catalog(mode, env):
    if mode == "--source":
        host, port, db, user, password, sslmode = checked_source_connection(env["DATABASE_URL"])
        if SOURCE_REF not in (host + user) or TARGET_REF in (host + user):
            raise ValueError("Source identity not allowed")
        args = dict(host=host, port=port, dbname=db, user=user, password=password,
                    sslmode=sslmode, connect_timeout=12, autocommit=True)
        cert = nullcontext(None)
    else:
        args = checked_target_connection(env["INSUREIT_RECOVERY_DATABASE_URL"])
        cert = isolated_ssl_root_cert()
    import psycopg
    with cert as root:
        if mode == "--target":
            args.update(sslmode="verify-full", sslrootcert=root,
                        connect_timeout=12, autocommit=True)
        with psycopg.connect(**args) as conn:
            with conn.cursor() as cur:
                cur.execute("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY")
                try:
                    cur.execute("SET LOCAL statement_timeout = '10000ms'")
                    if scalar(cur, "SELECT current_setting('transaction_read_only')") != "on":
                        raise RuntimeError("Read-only SQL transaction not active")
                    metrics = catalog(cur)
                    if mode == "--target":
                        metrics.update(target_details(cur))
                finally:
                    cur.execute("ROLLBACK")
    return metrics


def verify(source, target):
    if not isinstance(source, dict) or not isinstance(target, dict):
        raise ValueError("Missing R7 catalog results")
    expected_source = {
        "public_tables": 184, "has_recent_queue": 1, "auth_users": 87,
        "auth_identities": 91, "storage_buckets": 9, "storage_public": 2,
        "storage_policies": 35, "public_policies": 252,
        "auth_user_triggers": 1, "realtime_publications": 5,
        "public_security_definers": 392,
    }
    expected_target = {
        "public_tables": 183, "has_recent_queue": 0,
        "auth_users": 87, "auth_identities": 91,
        "storage_buckets": 8, "storage_public": 0, "storage_objects": 304,
        "storage_policies": 0, "public_policies": 252,
        "auth_user_triggers": 0, "realtime_publications": 0,
        "public_security_definers": 392, "sample_size_rows": 304,
        "sample_bytes": 499999884, "unowned_objects": 304,
        "target_exposed_tables": 0, "target_write_tables": 0, "public_rls_tables": 183,
    }
    if any(type(source.get(k)) is not int or source[k] != v for k, v in expected_source.items()):
        raise RuntimeError("Source catalog drift requires private review")
    if any(type(target.get(k)) is not int or target[k] != v for k, v in expected_target.items()):
        raise RuntimeError("Isolated target drift requires private review")
    for key in ("migrations", "storage_objects"):
        if type(source.get(key)) is not int or source[key] < 1:
            raise RuntimeError("Source catalog incomplete")
    if (type(target.get("migrations")) is not int or target["migrations"] != 2 or
            source["schema_digest_without_queue"] != target["schema_digest_without_queue"] or
            type(source.get("schema_digest_without_queue")) is not str or
            len(source["schema_digest_without_queue"]) != 64):
        raise RuntimeError("Source/target metadata fingerprint differs")
    return True


def main(argv, env=os.environ):
    if len(argv) != 2 or argv[1] not in ("--source", "--target"):
        raise ValueError("R7 requires --source or --target")
    snapshot_lock(env)
    mode = argv[1]
    state = read_catalog(mode, env)
    if mode == "--source":
        if not env.get("GITHUB_OUTPUT"):
            raise ValueError("Protected GitHub job output required")
        # Only aggregate counts and table-schema digest (no identifiers/rows/secrets).
        with open(env["GITHUB_OUTPUT"], "a", encoding="utf-8") as output:
            output.write("summary=" + json.dumps(state, sort_keys=True, separators=(",", ":")) + "\n")
        print("R7 SOURCE METADATA CAPTURED: read_only=1 safe_aggregate_only=1")
    else:
        source = json.loads(env["R7_SOURCE_SUMMARY"])
        verify(source, state)
        print("R7 READ-ONLY CATALOG PASS: restored_sample=304 private_buckets=8 "
              "storage_bytes=499999884 expected_source_drift=1 "
              "sql_snapshot_is_historical=1 storage_snapshot_is_historical=1 "
              "no_target_write=1 no_production_write=1 not_DR_certified=1")


if __name__ == "__main__":
    try:
        main(sys.argv)
    except Exception as exc:
        print(f"R7 READ-ONLY STOP: category={type(exc).__name__}; "
              "sensitive SQL, credentials and customer identifiers withheld", file=sys.stderr)
        sys.exit(1)
