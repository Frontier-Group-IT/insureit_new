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


def main():
    if len(sys.argv) != 3 or sys.argv[1] not in ("extensions", "fixture", "roles", "schema", "data"):
        raise SystemExit("usage: classify_pg_restore_error.py extensions|fixture|roles|schema|data LOGFILE")
    with open(Path(sys.argv[2]), "rb") as f:
        raw = f.read(MAX_READ + 1)
    if len(raw) > MAX_READ:
        print(f"RESTORE DIAGNOSTIC: component={sys.argv[1]} category=log_limit_exceeded")
        return
    category = classify(raw.decode("utf-8", "replace"))
    print(f"RESTORE DIAGNOSTIC: component={sys.argv[1]} category={category}")
    print("Restore remains FAILED. Review Supabase-compatible isolated target; no SQL content logged.")


if __name__ == "__main__":
    main()
