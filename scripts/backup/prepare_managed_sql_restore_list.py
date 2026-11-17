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
# PostgreSQL's built-in namespaces can appear in custom archive TOCs for
# catalogue-related objects/metadata. These are NOT application schemas and
# must never be selected for restoration into a managed Supabase target.
# Exact allowlist only: do not trust a prefix like pg_* or arbitrary schema.
DEFERRED_SYSTEM_SCHEMAS = frozenset({"pg_catalog", "information_schema"})
# Never replay pre-existing managed schema DDL, extensions or global role ACL.
# Application-owned objects replay without source owner or ACL in initial drill.
APP_OBJECTS = frozenset({
    "TABLE", "TABLE DATA", "VIEW", "MATERIALIZED VIEW",
    "MATERIALIZED VIEW DATA", "INDEX", "CONSTRAINT", "CHECK CONSTRAINT", "FK CONSTRAINT",
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
# PostgreSQL 17 pg_dump always emits the first three session-setup entries
# (ENCODING, STDSTRINGS, SEARCHPATH). These are neither application schema
# nor customer rows. Recognize and DEFER them rather than rejecting the whole
# verified custom archive. Other documented PG17 descriptors below are also
# recognized but NEVER selected into this restricted target import.
# All unrecognized descriptors still fail closed.
PG17_DEFERRED_KINDS = frozenset({
    "ENCODING", "STDSTRINGS", "SEARCHPATH",
    "PROCEDURAL LANGUAGE", "FOREIGN DATA WRAPPER", "CONVERSION",
    "PUBLICATION TABLES IN SCHEMA", "SUBSCRIPTION TABLE",
    "BLOB DATA", "BLOB METADATA", "SHELL TYPE", "ACCESS METHOD", "TABLE ACCESS METHOD",
    "STATISTICS DATA", "EXTENDED STATISTICS DATA",
})


class SafeTocSelectionError(ValueError):
    """Only fixed error classes are safe to send to GitHub Actions logs."""

    def __init__(self, reason):
        if reason not in ("UNRECOGNIZED_TOC_RECORD",
                          "UNKNOWN_TOC_DESCRIPTOR",
                          "INVALID_TOC_FIELDS",
                          "INVALID_TOC_SHAPE",
                          "UNKNOWN_ARCHIVE_NAMESPACE",
                          "INVALID_TOC_IDENTIFIER"):
            raise AssertionError("Unexpected private TOC failure category")
        super().__init__("Private archive TOC denied")
        self.reason = reason


TOC_KINDS = sorted((APP_OBJECTS | PG17_DEFERRED_KINDS | {
    "ACL", "DEFAULT ACL", "COMMENT", "SECURITY LABEL", "EXTENSION",
    "SCHEMA", "EVENT TRIGGER", "PUBLICATION", "PUBLICATION TABLE",
    "SUBSCRIPTION", "BLOB", "BLOBS", "BLOB COMMENTS",
    "TABLESPACE", "DATABASE", "DATABASE PROPERTIES",
}), key=len, reverse=True)
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
        # Classify only the STRUCTURE, never the source object's name/tag.
        # PostgreSQL 17 emits CHECK CONSTRAINT (including on domains);
        # unknown descriptors remain blocked, not implicitly deferred.
        # This separates an unrecognized descriptor from a malformed line
        # for the NEXT protected dry-run without leaking private identifiers.
        header = re.match(r"^\s*\d+;\s+\d+\s+\d+\s+(.+)$", line)
        if not header:
            raise SafeTocSelectionError("INVALID_TOC_SHAPE")
        payload = header.group(1)
        if any(payload.startswith(kind + " ") for kind in TOC_KINDS):
            raise SafeTocSelectionError("INVALID_TOC_FIELDS")
        raise SafeTocSelectionError("UNKNOWN_TOC_DESCRIPTOR")
    number, kind, namespace, rest = m.groups()
    if namespace not in APP_SCHEMAS | MANAGED_SCHEMAS | DEFERRED_SYSTEM_SCHEMAS | {
        "-", "extensions", "graphql", "graphql_public", "pgbouncer",
    }:
        raise SafeTocSelectionError("UNKNOWN_ARCHIVE_NAMESPACE")
    if not number.isascii() or not number.isdigit():
        raise SafeTocSelectionError("INVALID_TOC_IDENTIFIER")
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
        if ns in DEFERRED_SYSTEM_SCHEMAS:
            # Redundant explicit denial: even if another selected kind gains
            # broad permissions later, core pg_catalog objects are never
            # replayed by this application-only recovery.
            include = False
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


def read_target_auth_foreign_keys():
    """Read only: discover enforced Auth FK dependencies on isolated Supabase.

    Source rows and SQL are never fetched. This must execute only after the
    protected workflow has validated the target URL and its project CA.
    """
    import os
    import psycopg
    from managed_recovery_preflight import (
        checked_target_connection, isolated_ssl_root_cert,
    )

    params = checked_target_connection(os.environ["INSUREIT_RECOVERY_DATABASE_URL"])
    with isolated_ssl_root_cert() as root_cert:
        with psycopg.connect(
            **params, sslmode="verify-full", sslrootcert=root_cert,
            connect_timeout=12, autocommit=True,
        ) as connection:
            with connection.cursor() as cur:
                cur.execute("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY")
                try:
                    cur.execute(
                        "SELECT child.relname, parent_ns.nspname, parent.relname "
                        "FROM pg_catalog.pg_constraint c "
                        "JOIN pg_catalog.pg_class child ON child.oid=c.conrelid "
                        "JOIN pg_catalog.pg_namespace child_ns "
                        "  ON child_ns.oid=child.relnamespace "
                        "JOIN pg_catalog.pg_class parent ON parent.oid=c.confrelid "
                        "JOIN pg_catalog.pg_namespace parent_ns "
                        "  ON parent_ns.oid=parent.relnamespace "
                        "WHERE c.contype='f' AND child_ns.nspname='auth'"
                    )
                    rows = cur.fetchall()
                finally:
                    cur.execute("ROLLBACK")
    if any(parent_schema != "auth" for _, parent_schema, _ in rows):
        raise RuntimeError("Managed Auth has unexpected cross-schema FK")
    edges = {(child, parent) for child, _, parent in rows}
    # This isolated Supabase target has 24 enforced Auth FKs. A surprising
    # catalog change must stop import, not silently drop constraints.
    if len(edges) < 20 or ("identities", "users") not in edges:
        raise RuntimeError("Missing expected isolated Auth FK dependency baseline")
    return edges


def order_auth_copy_by_foreign_keys(lines, edges):
    """Move only Auth TABLE DATA TOC entries into target-FK parent-first order.

    All other approved TOC entries keep their relative order. pg_restore -L
    explicitly honors the order of items in this list. No trigger/FK disable.
    """
    if not edges or ("identities", "users") not in edges:
        raise ValueError("Target Auth FK dependency evidence required")
    auth_items = {}
    auth_indices = set()
    for index, line in enumerate(lines):
        kind, schema, rest = parse_entry(line)
        if schema == "auth" and kind == "TABLE DATA":
            table = rest.split()[0]
            if table in auth_items:
                raise ValueError("Duplicate Auth COPY destination")
            auth_items[table] = (index, line)
            auth_indices.add(index)
    if len(auth_items) < MIN_AUTH_DATA:
        raise ValueError("Incomplete managed Auth COPY set")
    if "users" not in auth_items or "identities" not in auth_items:
        raise ValueError("Required Auth user/identity COPY entries missing")

    dependencies = {name: set() for name in auth_items}
    constrained_edges = 0
    for child, parent in edges:
        if child not in auth_items:
            continue
        if parent == child:
            raise ValueError("Self-referential Auth FK requires separate review")
        if parent not in auth_items:
            # The destination has no data, so a missing parent cannot be
            # assumed safe just because a particular source table might be empty.
            raise ValueError("Auth FK parent COPY entry missing from selection")
        dependencies[child].add(parent)
        constrained_edges += 1
    if ("users" not in dependencies["identities"] or constrained_edges < 15):
        raise ValueError("Incomplete Auth FK dependency coverage")

    ordered = []
    done = set()
    while len(ordered) < len(auth_items):
        ready = [
            name for name, (index, _) in auth_items.items()
            if name not in done and dependencies[name].issubset(done)
        ]
        if not ready:
            raise ValueError("Auth FK dependency cycle blocks safe COPY")
        next_name = min(ready, key=lambda name: auth_items[name][0])
        done.add(next_name)
        ordered.append(next_name)
    if ordered.index("users") >= ordered.index("identities"):
        raise AssertionError("Auth users must load before identities")

    remaining = [line for index, line in enumerate(lines) if index not in auth_indices]
    first_copy = next(
        (i for i, line in enumerate(remaining)
         if parse_entry(line)[0] == "TABLE DATA"),
        None,
    )
    if first_copy is None:
        raise ValueError("Application COPY data section missing")
    ordered_auth = [auth_items[name][1] for name in ordered]
    output = remaining[:first_copy] + ordered_auth + remaining[first_copy:]
    if len(output) != len(lines):
        raise AssertionError("Auth ordering must preserve all selected TOC entries")
    return output, constrained_edges


def build_list(source, destination, auth_fk_edges=None):
    source = Path(source)
    dest = Path(destination)
    if not source.is_file() or not 0 < source.stat().st_size <= MAX_TOC_BYTES:
        raise ValueError("Missing or oversized private TOC")
    if dest.exists():
        raise ValueError("Refusing to overwrite preexisting restore list")
    lines, counts = chosen_entries(source.read_text(encoding="utf-8"))
    if auth_fk_edges is not None:
        lines, ordered_fk_edges = order_auth_copy_by_foreign_keys(lines, auth_fk_edges)
        print("R4 AUTH FK COPY ORDER VERIFIED:"
              f" auth_copy_targets={counts[('auth','TABLE DATA')]}"
              f" enforced_fk_edges={ordered_fk_edges}"
              " users_before_identities=1 no_fk_disable=1")
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
        # Fail closed: protected R4 CLI ALWAYS obtains the target's enforced
        # Auth FK graph via authenticated, TLS-verified read-only catalog SQL.
        build_list(sys.argv[1], sys.argv[2],
                   auth_fk_edges=read_target_auth_foreign_keys())
    except SafeTocSelectionError as exc:
        print("TARGET MANAGED SQL SELECTION FAILED:"
              f" failure_code={exc.reason}; private TOC names withheld",
              file=sys.stderr)
        raise SystemExit(1) from None
    except Exception as exc:
        print(f"TARGET MANAGED SQL SELECTION FAILED: category={type(exc).__name__};"
              " private TOC names withheld", file=sys.stderr)
        raise SystemExit(1) from None
