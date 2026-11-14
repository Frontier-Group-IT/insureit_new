#!/usr/bin/env python3
"""Fail-closed TOC selection for a target-only INSUREIT managed SQL import.

Does not connect to any database and does not execute SQL. Prints only counts.
Only the separate reviewed, protected R4 workflow may consume its output.
"""
from collections import Counter
from pathlib import Path
import re
import sys

APP_SCHEMAS = frozenset({
    "public", "identity_maintenance", "insureit_recovery",
    "insureit_control", "private",
})
MANAGED_SCHEMAS = frozenset({
    "auth", "storage", "vault", "realtime", "supabase_migrations",
})
# Never replay pre-existing managed schema DDL, extensions or global role ACL.
# Application-owned objects replay without source owner or ACL in initial drill.
APP_OBJECTS = frozenset({
    "TABLE", "TABLE DATA", "VIEW", "MATERIALIZED VIEW",
    "MATERIALIZED VIEW DATA", "INDEX", "CONSTRAINT", "FK CONSTRAINT",
    "SEQUENCE", "SEQUENCE OWNED BY", "SEQUENCE SET", "FUNCTION", "PROCEDURE", "TRIGGER",
    "POLICY", "ROW SECURITY", "TYPE", "DOMAIN", "DEFAULT", "RULE",
    "TABLE ATTACH", "INDEX ATTACH", "STATISTICS", "AGGREGATE", "COLLATION", "OPERATOR",
    "OPERATOR CLASS", "OPERATOR FAMILY", "TEXT SEARCH CONFIGURATION",
    "TEXT SEARCH DICTIONARY", "TEXT SEARCH PARSER", "TEXT SEARCH TEMPLATE",
    "TRANSFORM", "FOREIGN TABLE", "SERVER", "USER MAPPING",
    "DOMAIN CONSTRAINT", "CAST",
})
# We do NOT grant/alter login roles, execute trusted extensions or copy Vault
# root keys. All such items require separate managed-service verification.
ALLOWED_MANAGED = frozenset({
    # Supabase managed table owners are NOT members of the target postgres
    # role. Do not attempt CREATE TRIGGER auth.users or CREATE POLICY storage.*
    # under unapproved elevated managed service credentials.
    ("TABLE DATA", "auth"),
})
TOC_KINDS = sorted(APP_OBJECTS | {
    "ACL", "DEFAULT ACL", "COMMENT", "SECURITY LABEL", "EXTENSION",
    "SCHEMA", "EVENT TRIGGER", "PUBLICATION", "PUBLICATION TABLE",
    "SUBSCRIPTION", "BLOB", "BLOBS", "BLOB COMMENTS",
    "TABLESPACE", "DATABASE", "DATABASE PROPERTIES",
}, key=len, reverse=True)
RECORD = re.compile(
    r"^\s*(\d+);\s+\d+\s+\d+\s+("
    + "|".join(re.escape(x) for x in TOC_KINDS)
    + r")\s+(\S+)\s+(.+)$"
)
MAX_TOC_BYTES = 32 * 1024 * 1024
MIN_PUBLIC_TABLES = 150
MIN_AUTH_DATA = 20


def parse_entry(line):
    if not line.strip() or line.lstrip().startswith(";"):
        return None
    m = RECORD.match(line)
    if not m:
        # Failing on previously unrecognized archive types prevents silently
        # omitting application SQL or replaying an unreviewed global object.
        raise ValueError("Unrecognized R2 archive TOC entry")
    number, kind, namespace, rest = m.groups()
    if namespace not in APP_SCHEMAS | MANAGED_SCHEMAS | {
        "-", "extensions", "graphql", "graphql_public", "pgbouncer",
    }:
        raise ValueError("Unknown archive schema: review required")
    if not number.isascii() or not number.isdigit():
        raise ValueError("Invalid archive TOC item")
    return kind, namespace, rest


def chosen_entries(raw_toc):
    if len(raw_toc.encode("utf-8")) > MAX_TOC_BYTES:
        raise ValueError("Oversized private archive TOC")
    counts = Counter()
    all_app = Counter()
    app_definitions = set()
    app_data_targets = set()
    chosen = []
    for line in raw_toc.splitlines(keepends=True):
        parsed = parse_entry(line)
        if not parsed:
            continue
        kind, ns, rest = parsed
        if kind == "TABLE" and ns in APP_SCHEMAS:
            all_app[ns] += 1
            app_definitions.add((ns, rest.split()[0]))
        if kind == "TABLE DATA" and ns in APP_SCHEMAS:
            app_data_targets.add((ns, rest.split()[0]))

        if ns == "auth" and kind == "TABLE DATA" and rest.startswith("schema_migrations "):
            # Managed Auth schema_migrations belongs to supabase_auth_admin
            # and postgres has NO INSERT. Never spoof Auth version history.
            counts["deferred_auth_schema_migrations"] += 1

        # The app custom schema itself does not exist in a fresh Supabase
        # project. Default managed/public/extensions schemas already do.
        include = (
            (kind == "SCHEMA" and ns == "-"
             and rest.split()[0] in APP_SCHEMAS - {"public"})
            or (ns in APP_SCHEMAS and kind in APP_OBJECTS)
            or (kind, ns) in ALLOWED_MANAGED
        )
        # A Supabase target may already have the default RLS event-trigger
        # helper; do not overwrite it by replaying its source function.
        if ns == "auth" and kind == "TABLE DATA" and rest.startswith("schema_migrations "):
            include = False
        if ns == "public" and kind in ("FUNCTION", "PROCEDURE"):
            if rest.startswith("rls_auto_enable("):
                include = False
                counts["excluded_preseeded_rls_helper"] += 1
        if ns == "auth" and kind == "TRIGGER":
            # Managed auth.users is owned by supabase_auth_admin; postgres is
            # not a member. Defer trigger DDL to a separately supported path.
            include = False
        if ns == "storage" and kind == "POLICY":
            # Managed storage.objects/buckets are owned by
            # supabase_storage_admin. Importing policies as postgres would
            # fail owner checks; never escalate privileges opportunistically.
            include = False
        # Source ACLs and privileges, event triggers, managed extension DDL,
        # role statements and non-application tables are NOT applied here.
        if include:
            chosen.append(line)
            counts[(ns, kind)] += 1
        if kind == "TABLE DATA" and ns == "storage" and include:
            raise AssertionError("Never import stale Storage metadata")
    if not app_data_targets.issubset(app_definitions):
        raise ValueError("Archived app COPY target missing table definition")
    if all_app["public"] < MIN_PUBLIC_TABLES:
        raise ValueError("Archive missing application table definitions")
    if counts[("public", "TABLE")] != all_app["public"]:
        raise ValueError("Incomplete public application schema selection")
    if counts[("public", "TABLE DATA")] < MIN_PUBLIC_TABLES:
        raise ValueError("Archive missing public application data destinations")
    if counts[("auth", "TABLE DATA")] < MIN_AUTH_DATA:
        raise ValueError("Archive missing required Auth tables")
    if counts[("storage", "POLICY")] or counts[("auth", "TRIGGER")]:
        raise ValueError("Unapproved managed Auth/Storage DDL in selection")
    # All app table COPY entries selected; no unintended managed data.
    for ns in APP_SCHEMAS:
        if ns == "public":
            continue
        if all_app[ns] and counts[(ns, "TABLE")] != all_app[ns]:
            raise ValueError("Incomplete nonpublic app schema selection")
    return chosen, counts


def build_list(source, destination):
    source = Path(source)
    dest = Path(destination)
    if not source.is_file() or not 0 < source.stat().st_size <= MAX_TOC_BYTES:
        raise ValueError("Missing or oversized private TOC")
    if dest.exists():
        raise ValueError("Refusing to overwrite preexisting restore list")
    lines, counts = chosen_entries(source.read_text(encoding="utf-8"))
    # TOC names and original owners are confidential; only the private
    # runner-local list is written; no artifact upload or stdout excerpt.
    dest.write_text("".join(lines), encoding="utf-8")
    dest.chmod(0o600)
    print("TARGET MANAGED SQL RESTORE LIST PREPARED:"
          f" selected_entries={len(lines)}"
          f" public_tables={counts[('public','TABLE')]}"
          f" public_data_targets={counts[('public','TABLE DATA')]}"
          f" auth_data_targets={counts[('auth','TABLE DATA')]}"
          f" managed_storage_policies_deferred=1"
          f" managed_auth_trigger_deferred=1"
          f" other_private_entries={sum(v for k,v in counts.items() if isinstance(k,tuple) and k[0] in APP_SCHEMAS - {'public'})}")
    print("DEFERRED: Auth owner-only trigger, Storage owner-only policies and all Storage file/metadata; Vault, Realtime, source owner/ACL")


if __name__ == "__main__":
    try:
        if len(sys.argv) != 3:
            raise ValueError("Usage: prepare_managed_sql_restore_list.py PRIVATE_TOC PRIVATE_LIST")
        build_list(sys.argv[1], sys.argv[2])
    except Exception as exc:
        print(f"TARGET MANAGED SQL SELECTION FAILED: category={type(exc).__name__};"
              " private TOC names withheld", file=sys.stderr)
        raise SystemExit(1)
