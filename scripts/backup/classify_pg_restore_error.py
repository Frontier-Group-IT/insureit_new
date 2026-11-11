#!/usr/bin/env python3
"""Print a bounded, allowlisted classification of offline PostgreSQL restore failures.

Do NOT print raw SQL, object names, customer data, log paths or connection strings.
Restore must still fail closed, regardless of classification.
"""
import re
import sys
from pathlib import Path

MAX_READ = 1_000_000
CLASSES = (
    ("ambiguous_column", re.compile(r'column reference .{0,200} is ambiguous', re.I)),
    ("role_creation_denied", re.compile(r'permission denied to create role|must have CREATEROLE privilege', re.I)),
    ("reserved_role", re.compile(r'reserved role|role name .{0,200} is reserved', re.I)),
    ("role_missing", re.compile(r'role .{0,200} does not exist', re.I)),
    ("role_exists", re.compile(r'role .{0,200} already exists', re.I)),
    ("extension_missing", re.compile(r'extension .{0,200} is not available', re.I)),
    ("schema_missing", re.compile(r'schema .{0,200} does not exist', re.I)),
    ("permission_denied", re.compile(r'permission denied|must be (?:owner|superuser)', re.I)),
    ("sql_syntax_error", re.compile(r'syntax error at or near', re.I)),
    ("object_exists", re.compile(r'(?:relation|schema|type|function) .{0,200} already exists', re.I)),
    ("foreign_key_failure", re.compile(r'foreign key constraint|violates foreign key', re.I)),
    ("missing_function_or_type", re.compile(r'(?:function|type) .{0,200} does not exist', re.I)),
    ("connection_failure", re.compile(r'connection refused|could not connect', re.I)),
)


def classify(contents):
    # Scan only error lines; do not expose underlying names or raw SQL.
    for line in contents.splitlines():
        if not re.search(r'(?:ERROR:|FATAL:|psql:.*error:)', line, re.I):
            continue
        for category, pattern in CLASSES:
            if pattern.search(line):
                return category
    return "unknown_sql_failure"



SAFE_SCHEMAS = (
    "auth", "storage", "extensions", "vault", "public", "realtime",
    "pg_catalog", "graphql", "supabase_migrations",
)
MISSING_DEPENDENCY = re.compile(
    r'\b(?P<kind>function|type|operator)\s+(?P<object>.{1,200}?)\s+does not exist\b',
    re.I,
)
PSQL_LINE = re.compile(r'\bpsql:[^:\n]*:(?P<line>[0-9]{1,8}):\s*(?:ERROR|FATAL):', re.I)


def dependency_details(contents):
    """Only fixed schema/kind categories and a SQL line number; no SQL text."""
    for line in contents.splitlines():
        if not re.search(r'(?:ERROR:|FATAL:|psql:.*error:)', line, re.I):
            continue
        match = MISSING_DEPENDENCY.search(line)
        if not match:
            continue
        signature = match.group("object")
        schema = "unqualified_or_other"
        for allowed in SAFE_SCHEMAS:
            if re.search(r'(?<![A-Za-z0-9_])"?' + re.escape(allowed)
                         + r'"?\s*\.\s*"?[A-Za-z_][A-Za-z0-9_]*',
                         signature, re.I):
                schema = allowed
                break
        loc = PSQL_LINE.search(line)
        return {
            "kind": match.group("kind").lower(),
            "schema": schema,
            "sql_line": int(loc.group("line")) if loc else None,
        }
    return None

# pg_restore writes the TOC entry that failed to its *private* stderr log.
# Return only a bounded numeric entry id and a fixed, allowlisted object kind/
# schema. Never echo the object name, SQL, table contents, or a freeform field.
PG_RESTORE_TOC = re.compile(
    r"(?im)^pg_restore:\s+from TOC entry\s+(?P<entry>[0-9]{1,8});\s+"
    r"[0-9]+\s+[0-9]+\s+(?P<kind>DEFAULT ACL|TABLE DATA|SEQUENCE SET|"
    r"ACL|SCHEMA|EXTENSION|TABLE|FUNCTION|TYPE|POLICY|TRIGGER|INDEX|"
    r"CONSTRAINT|FK CONSTRAINT|VIEW|MATERIALIZED VIEW)\s+"
    r"(?:(?:TABLE|SEQUENCE|SCHEMA|FUNCTION)\s+)?"
    r"(?P<schema>[^\s]+)"
)


def toc_error_context(contents):
    match = PG_RESTORE_TOC.search(contents)
    if not match:
        return None
    raw_schema = match.group("schema").strip('"').lower()
    return {
        "toc_entry": int(match.group("entry")),
        "kind": match.group("kind").lower().replace(" ", "_"),
        "schema": raw_schema if raw_schema in SAFE_SCHEMAS else "other_or_unqualified",
    }


# Exact role NAME family collected from the live source catalog only.
# Never output database role identifiers, function names or SQL from errors.
SOURCE_ROLE_NAMES = frozenset({
    "anon", "authenticated", "authenticator", "cli_login_postgres",
    "dashboard_user", "postgres", "service_role", "supabase_admin",
    "supabase_auth_admin", "supabase_etl_admin", "supabase_privileged_role",
    "supabase_read_only_user", "supabase_realtime_admin",
    "supabase_replication_admin", "supabase_storage_admin",
})
ROLE_NAME_ERROR = re.compile(r"role\s+[\"']?(?P<name>[A-Za-z_][A-Za-z0-9_]*)[\"']?\s+does not exist", re.I)


def missing_role_context(contents):
    for line in contents.splitlines():
        if not re.search(r"(?:ERROR:|FATAL:|psql:.*error:)", line, re.I):
            continue
        match = ROLE_NAME_ERROR.search(line)
        if match:
            role = match.group("name").lower()
            return {
                "source_catalog_match": int(role in SOURCE_ROLE_NAMES),
                "managed_family": int(role.startswith("supabase_")),
            }
    return None


def main():
    if len(sys.argv) != 3 or sys.argv[1] not in ("auth_bootstrap", "extensions", "fixture", "roles", "schema", "data"):
        raise SystemExit("usage: classify_pg_restore_error.py auth_bootstrap|extensions|fixture|roles|schema|data LOGFILE")
    with open(Path(sys.argv[2]), "rb") as f:
        raw = f.read(MAX_READ + 1)
    if len(raw) > MAX_READ:
        print(f"RESTORE DIAGNOSTIC: component={sys.argv[1]} category=log_limit_exceeded")
        return
    category = classify(raw.decode("utf-8", "replace"))
    print(f"RESTORE DIAGNOSTIC: component={sys.argv[1]} category={category}")
    if category in ("permission_denied", "role_missing"):
        context = toc_error_context(raw.decode("utf-8", "replace"))
        if context:
            label = "RESTORE PERMISSION CONTEXT" if category == "permission_denied" else "RESTORE ROLE TOC CONTEXT"
            print(f"{label}: toc_entry={context['toc_entry']} kind={context['kind']} schema={context['schema']}")
        if category == "role_missing":
            match = missing_role_context(raw.decode("utf-8", "replace"))
            if match:
                print(f"RESTORE ROLE CLASS: source_catalog_match={match['source_catalog_match']} managed_family={match['managed_family']}")
    if category == "missing_function_or_type":
        details = dependency_details(raw.decode("utf-8", "replace"))
        if details:
            sql_line = details["sql_line"] if details["sql_line"] is not None else "unknown"
            print(f"RESTORE DEPENDENCY: kind={details['kind']} schema={details['schema']} sql_line={sql_line}")
    print("Restore remains FAILED. Review Supabase-compatible isolated target; no SQL content logged.")


if __name__ == "__main__":
    main()
