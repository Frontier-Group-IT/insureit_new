#!/usr/bin/env python3
"""Compare COPY row counts in R2 SQL to offline-restored PostgreSQL 17 tables.

Does not print SQL, private values or row counts. It never connects to production.
"""
from pathlib import Path
import re
import subprocess
import sys

from audit_postgres_archive_coverage import COPY, REQUIRED_DATA

COPY_END = re.compile(r'^\s*\\\.\s*$')
MAX_COPY_BYTES = 768 * 1024 * 1024


def expected_copy_rows(data_path):
    counts = {x: 0 for x in REQUIRED_DATA}
    active = None
    # Stream rows to avoid holding sensitive SQL in memory.
    if Path(data_path).stat().st_size > MAX_COPY_BYTES:
        raise RuntimeError("SQL exceeds offline comparison limit")
    with open(data_path, encoding="utf-8", errors="replace") as f:
        for line in f:
            if active is None:
                match = COPY.match(line)
                if match:
                    key = ((match.group("schema") or "public").lower(),
                           match.group("table").lower())
                    if key in REQUIRED_DATA:
                        active = key
                    else:
                        active = ("ignored", "ignored")
            elif COPY_END.match(line):
                active = None
            elif active in counts:
                counts[active] += 1
    return counts


def live_count(container, schema, table):
    if not re.fullmatch(r'[a-z_][a-z_0-9]*', schema) or not re.fullmatch(r'[a-z_][a-z_0-9]*', table):
        raise RuntimeError("Invalid isolated table name")
    result = subprocess.run(
        ["docker", "exec", "-u", "postgres", container, "psql", "-X", "-A", "-t",
         "-v", "ON_ERROR_STOP=1", "-d", "postgres",
         "-c", f'SELECT count(*) FROM "{schema}"."{table}";'],
        capture_output=True, text=True, timeout=45, check=False,
    )
    if result.returncode != 0:
        raise RuntimeError("Isolated count query failed")
    val = result.stdout.strip()
    if not val.isdigit():
        raise RuntimeError("Unexpected isolated count output")
    return int(val)


def main():
    if len(sys.argv) != 3 or sys.argv[2] != "insureit-restore-check":
        raise RuntimeError("Only the offline restore target is authorized")
    counts = expected_copy_rows(Path(sys.argv[1]) / "data.sql")
    for schema, table in sorted(REQUIRED_DATA):
        actual = live_count("insureit-restore-check", schema, table)
        if actual != counts[(schema, table)]:
            print(f"ISOLATED RECORD COMPARISON FAILED: {schema}.{table} row count mismatch", flush=True)
            raise SystemExit(1)
        print(f"ISOLATED RECORD COMPARISON PASSED: {schema}.{table} count matches archived COPY", flush=True)
    print("OFFLINE VALIDATION ONLY: database service config, auth operation, RLS and Storage binary object checks remain separate.")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"ISOLATED RECORD COMPARISON FAILED: {type(exc).__name__}", file=sys.stderr)
        sys.exit(1)
