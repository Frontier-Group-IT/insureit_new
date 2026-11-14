#!/usr/bin/env python3
"""R0/R1 ONLY: compare an authenticated v2 archive TOC to isolated managed catalogs.

Never imports rows, applies DDL, changes privileges, or reads customer data.
Logs only aggregate metadata, never SQL, role names, paths or credentials.
"""
from collections import Counter
import os
from pathlib import Path
import re
import ssl
import sys
from urllib.parse import parse_qsl, unquote, urlsplit

SOURCE_REF = "ilzhsfqqjyppzzvfscmh"
TARGET_REF = "klnodxnmlqbofolxxrsr"
TARGET_DIRECT = f"db.{TARGET_REF}.supabase.co"
POOLER_DOMAIN = ".pooler.supabase.com"
RECORD = re.compile(
    r"^\s*\d+;\s+\d+\s+\d+\s+"
    r"(TABLE DATA|TABLE|POLICY|SEQUENCE SET|FUNCTION|EXTENSION|SCHEMA)"
    r"\s+(\S+)\s+(\S+)(?:\s|$)"
)
MANAGED = frozenset(("auth", "storage", "realtime", "vault",
                     "supabase_migrations"))
MAX_TOC = 32 * 1024 * 1024


def checked_target_connection(url):
    """Returns libpq keyword args; URL may contain unescaped @ in password.

    A recognized pooler DNS suffix alone is NOT sufficient: username MUST
    include the isolated project ref, and the direct hostname must be exact.
    """
    if not isinstance(url, str) or not url or any(c in url for c in "\r\n\x00"):
        raise ValueError("Malformed target connection")
    parsed = urlsplit(url)
    if parsed.scheme not in ("postgres", "postgresql") or parsed.fragment:
        raise ValueError("Malformed target connection")
    host = parsed.hostname
    user = unquote(parsed.username or "", errors="strict")
    password = unquote(parsed.password or "", errors="strict")
    direct = host == TARGET_DIRECT and user == "postgres"
    pooler = (isinstance(host, str) and host.endswith(POOLER_DOMAIN)
              and host != POOLER_DOMAIN
              and user == f"postgres.{TARGET_REF}")
    if not (direct or pooler) or not password or parsed.path != "/postgres":
        raise ValueError("Unapproved destination")
    if SOURCE_REF in url or any(c in user + password for c in "\r\n\x00"):
        raise ValueError("Forbidden project reference or credentials")
    if parsed.port not in (None, 5432):
        raise ValueError("Session/direct port 5432 required")
    options = parse_qsl(parsed.query, strict_parsing=True,
                        keep_blank_values=True)
    if any(k != "sslmode" for k, _ in options) or len(options) > 1:
        raise ValueError("Unapproved connection options")
    if options and options[0][1] not in ("require", "verify-ca", "verify-full"):
        raise ValueError("TLS required")
    return dict(host=host, port=5432, dbname="postgres", user=user,
                password=password)


def toc_inventory(path):
    p = Path(path)
    if not p.is_file() or not 0 < p.stat().st_size <= MAX_TOC:
        raise ValueError("Missing or oversized private TOC")
    counts = Counter()
    archive_definitions = set()
    archive_data = set()
    for line in p.read_text(encoding="utf-8", errors="strict").splitlines():
        match = RECORD.match(line)
        if match is None:
            continue
        kind, schema, obj = match.groups()
        family = ("managed" if schema in MANAGED else
                  "application" if schema == "public" else "dependency")
        counts[(kind, family)] += 1
        if kind == "TABLE":
            archive_definitions.add((schema, obj))
        if kind == "TABLE DATA":
            archive_data.add((schema, obj))
    required = {("auth", "users"), ("storage", "buckets"),
                ("storage", "objects"),
                ("supabase_migrations", "schema_migrations")}
    if not required.issubset(archive_data):
        raise ValueError("Critical archived metadata missing")
    if not any(schema == "public" for schema, _ in archive_definitions):
        raise ValueError("Archived application schema missing")
    return counts, archive_definitions, archive_data


def query_target(connection_kwargs):
    # Imported only on a protected manual run. No database access in PR CI.
    import psycopg
    ca_bundle = ssl.get_default_verify_paths().cafile
    if not ca_bundle or not Path(ca_bundle).is_file():
        raise RuntimeError("System CA bundle unavailable")
    # TLS verifies endpoint hostname and CA, not merely encryption.
    with psycopg.connect(
        **connection_kwargs, sslmode="verify-full", sslrootcert=ca_bundle,
        options="-c default_transaction_read_only=on",
        connect_timeout=12, autocommit=True,
    ) as conn:
        with conn.cursor() as cur:
            cur.execute("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY")
            try:
                cur.execute(
                    "SELECT current_database(), current_setting('server_version_num'),"
                    " current_setting('default_transaction_read_only')"
                )
                db, version, read_only = cur.fetchone()
                if db != "postgres" or not version.startswith("17") or read_only != "on":
                    raise RuntimeError("Unexpected target connection state")
                cur.execute(
                    "SELECT n.nspname, c.relname FROM pg_catalog.pg_class c"
                    " JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace"
                    " WHERE c.relkind IN ('r','p') AND n.nspname NOT IN"
                    " ('pg_catalog','information_schema') AND"
                    " n.nspname NOT LIKE 'pg_toast%'"
                )
                table_set = {(s, n) for s, n in cur.fetchall()}
                cur.execute("SELECT extname,extversion FROM pg_catalog.pg_extension")
                extensions = dict(cur.fetchall())
                cur.execute(
                    "SELECT rolname FROM pg_catalog.pg_roles"
                    " WHERE rolname !~ '^pg_'"
                )
                roles = {row[0] for row in cur.fetchall()}
                cur.execute(
                    "SELECT count(*) FROM pg_catalog.pg_auth_members"
                )
                membership_count = cur.fetchone()[0]
                cur.execute("SELECT count(*) FROM auth.users")
                auth_users = cur.fetchone()[0]
                cur.execute("SELECT count(*) FROM auth.identities")
                identities = cur.fetchone()[0]
                cur.execute("SELECT count(*) FROM storage.buckets")
                buckets = cur.fetchone()[0]
                cur.execute("SELECT count(*) FROM storage.objects")
                objects = cur.fetchone()[0]
                cur.execute(
                    "SELECT count(*) FROM pg_catalog.pg_proc WHERE prosecdef"
                )
                definers = cur.fetchone()[0]
            finally:
                cur.execute("ROLLBACK")
    return dict(tables=table_set, extensions=extensions, roles=roles,
                memberships=membership_count, auth_users=auth_users,
                identities=identities, buckets=buckets, objects=objects,
                security_definers=definers)


def compare_archive(toc_path, target_url):
    counts, definitions, data = toc_inventory(toc_path)
    target = query_target(checked_target_connection(target_url))
    if any((target[k] != 0) for k in
           ("auth_users", "identities", "buckets", "objects")):
        raise RuntimeError("Isolated recovery project is no longer empty")
    public_tables = sum(s == "public" for s, _ in target["tables"])
    if public_tables:
        raise RuntimeError("Recovery target contains application tables")
    for kind in ("TABLE", "TABLE DATA"):
        print("MANAGED PREFLIGHT TOC:"
              f" kind={kind.lower().replace(' ', '_')}"
              f" public={counts[(kind,'application')]}"
              f" managed={counts[(kind,'managed')]}"
              f" dependencies={counts[(kind,'dependency')]}")
    missing_existing = len(definitions & target["tables"])
    missing_data_targets = len(data - target["tables"])
    print("MANAGED PREFLIGHT CATALOG:"
          f" archive_table_definitions={len(definitions)}"
          f" archive_data_targets={len(data)}"
          f" already_seeded_table_definitions={missing_existing}"
          f" data_targets_not_preseeded={missing_data_targets}"
          f" target_roles={len(target['roles'])}"
          f" target_role_memberships={target['memberships']}"
          f" target_security_definers={target['security_definers']}"
          f" target_ext_installed={len(target['extensions'])}")
    print("MANAGED PREFLIGHT: status=REVIEW_ONLY"
          " no_import=1 no_privilege_change=1 no_production_connection=1")
    # A green read-only inspection is NOT permission to import.
    return target


def main(argv):
    if len(argv) == 2 and argv[1] == "--check-target":
        checked_target_connection(os.environ["INSUREIT_RECOVERY_DATABASE_URL"])
        print("MANAGED PREFLIGHT TARGET ALLOWLIST PASSED")
        return
    if len(argv) == 3 and argv[1] == "--compare":
        compare_archive(argv[2], os.environ["INSUREIT_RECOVERY_DATABASE_URL"])
        return
    raise ValueError("Usage: managed_recovery_preflight.py --check-target | --compare PRIVATE_TOC")


if __name__ == "__main__":
    try:
        main(sys.argv)
    except Exception as error:
        print("MANAGED PREFLIGHT FAILED:"
              f" category={type(error).__name__};"
              " sensitive details withheld", file=sys.stderr)
        raise SystemExit(1)
