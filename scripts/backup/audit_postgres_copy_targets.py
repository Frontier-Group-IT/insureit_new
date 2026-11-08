#!/usr/bin/env python3
"""Fail-closed structural preflight for Supabase CLI data-only COPY archives.

Compare archived COPY destination tables and columns to the *isolated* target
PostgreSQL catalog before importing any records. No production connection.
Do not print archive SQL, table/column identifiers or customer content.
"""
from pathlib import Path
import json
import re
import subprocess
import sys

MAX_DATA_BYTES = 768 * 1024 * 1024
MAX_HEADERS = 25000
COPY = re.compile(r"^\s*COPY\s+(.*?)\s*\((.*?)\)\s+FROM\s+stdin\s*;\s*$", re.I)
IDENT = re.compile(r'(?:"(?:[^"]|"")*"|[a-z_][a-z_0-9$]*)', re.I)
END = re.compile(r"^\s*\\\.\s*$")
SAFE_SCHEMAS = frozenset({
    "auth", "storage", "public", "vault", "realtime", "extensions",
    "supabase_migrations", "insureit_recovery", "graphql",
})


def split_identifiers(text, delimiter):
    """Parse plain and PostgreSQL double-quoted identifiers only."""
    parts = []
    i = 0
    while i < len(text):
        while i < len(text) and text[i].isspace():
            i += 1
        match = IDENT.match(text, i)
        if not match:
            raise ValueError("Unrecognized COPY identifier syntax")
        word = match.group()
        parts.append(word[1:-1].replace('""', '"') if word.startswith('"') else word.lower())
        i = match.end()
        while i < len(text) and text[i].isspace():
            i += 1
        if i >= len(text):
            break
        if text[i] != delimiter:
            raise ValueError("Unsupported COPY identifier delimiter")
        i += 1
        if i >= len(text):
            raise ValueError("Truncated COPY identifier list")
    if not parts:
        raise ValueError("Empty COPY identifiers")
    return parts


def copy_destinations(file_path):
    """Only read header metadata; skip all private COPY body lines."""
    path = Path(file_path)
    if path.stat().st_size > MAX_DATA_BYTES:
        raise ValueError("Archived data exceeds compatibility audit size bound")
    targets = []
    in_copy = False
    with path.open(encoding="utf-8", errors="replace") as handle:
        for number, raw in enumerate(handle, start=1):
            if in_copy:
                if END.match(raw):
                    in_copy = False
                continue
            if raw.lstrip().upper().startswith("COPY "):
                match = COPY.fullmatch(raw.rstrip("\n\r"))
                if not match:
                    raise ValueError("Unrecognized COPY header")
                qualified = split_identifiers(match.group(1), ".")
                if len(qualified) != 2:
                    raise ValueError("COPY target must be explicitly schema-qualified")
                cols = split_identifiers(match.group(2), ",")
                if len(set(cols)) != len(cols):
                    raise ValueError("COPY column list contains duplicates")
                targets.append((qualified[0], qualified[1], tuple(cols), number))
                if len(targets) > MAX_HEADERS:
                    raise ValueError("Too many COPY targets for bounded audit")
                in_copy = True
    if in_copy:
        raise ValueError("Incomplete archived COPY body")
    if not targets:
        raise ValueError("No COPY destinations in archived data")
    return targets


CATALOG = """
SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
FROM (
  SELECT n.nspname AS schema, c.relname AS table,
         array_agg(a.attname ORDER BY a.attnum) AS columns
  FROM pg_catalog.pg_class AS c
  JOIN pg_catalog.pg_namespace AS n ON n.oid=c.relnamespace
  JOIN pg_catalog.pg_attribute AS a ON a.attrelid=c.oid
  WHERE c.relkind IN ('r','p','f') AND a.attnum > 0 AND NOT a.attisdropped
  GROUP BY n.nspname,c.relname
) AS t;
"""


def isolated_catalog(container):
    if container not in ("insureit-restore-check", "insureit-fixture-smoke"):
        raise ValueError("Only isolated INSUREIT recovery container is allowed")
    process = subprocess.run(
        ["docker", "exec", "-u", "postgres", container, "psql",
         "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1",
         "-d", "postgres", "-c", CATALOG],
        capture_output=True, text=True, check=False, timeout=60,
    )
    if process.returncode:
        raise ValueError("Isolated catalog query failed")
    try:
        records = json.loads(process.stdout.strip())
        if not isinstance(records, list):
            raise ValueError("Unexpected isolated catalog format")
        return {(r["schema"], r["table"]): set(r["columns"]) for r in records}
    except (KeyError, TypeError, json.JSONDecodeError) as exc:
        raise ValueError("Invalid isolated catalog response") from exc


def verify_targets(targets, catalog):
    """Return only sanitized results, never object identifiers."""
    failures = []
    for schema, table, cols, number in targets:
        target_columns = catalog.get((schema, table))
        if target_columns is None:
            failures.append(("missing_table", schema if schema in SAFE_SCHEMAS else "other", number))
        elif not set(cols).issubset(target_columns):
            failures.append(("missing_columns", schema if schema in SAFE_SCHEMAS else "other", number))
    return failures


def main():
    if len(sys.argv) != 3 or sys.argv[2] not in ("insureit-restore-check", "insureit-fixture-smoke"):
        raise ValueError("Usage: audit_postgres_copy_targets.py DATA_SQL OFFLINE_CONTAINER")
    targets = copy_destinations(sys.argv[1])
    catalog = isolated_catalog(sys.argv[2])
    failures = verify_targets(targets, catalog)
    missing_tables = sum(kind == "missing_table" for kind, _, _ in failures)
    missing_columns = sum(kind == "missing_columns" for kind, _, _ in failures)
    print(f"OFFLINE COPY TARGET AUDIT: targets={len(targets)} missing_tables={missing_tables} missing_column_sets={missing_columns}")
    if failures:
        first = failures[0]
        print(f"OFFLINE COPY TARGET INCOMPATIBLE: kind={first[0]} schema={first[1]} copy_header_line={first[2]}")
        raise SystemExit(1)
    print("OFFLINE COPY TARGET AUDIT PASSED: all referenced tables and column names exist; data values not validated")


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as error:
        print(f"OFFLINE COPY TARGET AUDIT FAILED: {type(error).__name__}; no SQL or identifiers exposed", file=sys.stderr)
        sys.exit(1)
