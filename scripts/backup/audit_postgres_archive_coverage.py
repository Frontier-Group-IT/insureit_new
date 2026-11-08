"""Audit SQL archive *coverage markers* without printing any SQL or customer data.

Presence of COPY statements is a necessary prerequisite, not proof that rows
restored successfully, and not a substitute for a full restore into Supabase.
"""
import re
import sys
from pathlib import Path

COPY = re.compile(
    r'^\s*COPY\s+(?:"?(?P<schema>[a-z_][a-z_0-9]*)"?\.)?"?(?P<table>[a-z_][a-z_0-9]*)"?\s*(?:\(|FROM\s)',
    re.IGNORECASE | re.MULTILINE,
)
DDL = re.compile(
    r'^\s*CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"?public"?\.)',
    re.IGNORECASE | re.MULTILINE,
)
REQUIRED_DATA = frozenset({
    ("auth", "users"), ("storage", "buckets"), ("storage", "objects"),
})


def inspect(roles, schema, data):
    for p in (roles, schema, data):
        if not p.is_file() or p.stat().st_size == 0:
            raise RuntimeError("Missing SQL backup component")
    sql = data.read_text(encoding="utf-8", errors="replace")
    markers = {(m.group("schema") or "public").lower(), m.group("table").lower())
               for m in COPY.finditer(sql)}
    missing = REQUIRED_DATA - markers
    schema_sql = schema.read_text(encoding="utf-8", errors="replace")
    table_count = len(DDL.findall(schema_sql))
    roles_present = roles.stat().st_size > 0
    return {
        "public_create_table_statements": table_count,
        "data_copy_statements": len(markers),
        "auth_users_marker": ("auth", "users") in markers,
        "storage_buckets_marker": ("storage", "buckets") in markers,
        "storage_objects_marker": ("storage", "objects") in markers,
        "migration_marker": ("supabase_migrations", "schema_migrations") in markers,
        "roles_nonempty": roles_present,
        "missing_count": len(missing),
        "coverage_gate": not missing and table_count > 0,
    }


def main():
    if len(sys.argv) != 2:
        raise SystemExit("Usage: audit_postgres_archive_coverage.py RESTORE_DIR")
    folder = Path(sys.argv[1])
    result = inspect(folder / "roles.sql", folder / "schema.sql", folder / "data.sql")
    for key, value in result.items():
        print(f"ARCHIVE COVERAGE {key}={str(value).lower() if isinstance(value, bool) else value}")
    print("COVERAGE IS SQL-MARKER-ONLY: no counts of restored records or Supabase service configuration.")
    if not result["coverage_gate"]:
        raise SystemExit("ARCHIVE COVERAGE INCOMPLETE: full recovery is not yet demonstrated")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"ARCHIVE COVERAGE AUDIT FAILED: {type(exc).__name__}", file=sys.stderr)
        sys.exit(1)
